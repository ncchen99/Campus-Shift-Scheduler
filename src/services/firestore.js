import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch,
    serverTimestamp,
    collectionGroup
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ============ ShiftRules ============
export async function getShiftRules() {
    const rulesRef = collection(db, 'shiftRules');
    const snapshot = await getDocs(rulesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function initializeShiftRules() {
    const defaultRules = [
        { ruleId: 'W1', appliesTo: 'weekday', start: '17:00', end: '21:00', label: '17:00~21:00' },
        { ruleId: 'W2', appliesTo: 'weekday', start: '21:00', end: '24:00', label: '21:00~24:00' },
        { ruleId: 'H1', appliesTo: 'weekend', start: '08:00', end: '12:00', label: '08:00~12:00' },
        { ruleId: 'H2', appliesTo: 'weekend', start: '12:00', end: '16:00', label: '12:00~16:00' },
        { ruleId: 'H3', appliesTo: 'weekend', start: '16:00', end: '20:00', label: '16:00~20:00' },
        { ruleId: 'H4', appliesTo: 'weekend', start: '20:00', end: '24:00', label: '20:00~24:00' },
    ];

    const batch = writeBatch(db);
    for (const rule of defaultRules) {
        const ruleRef = doc(db, 'shiftRules', rule.ruleId);
        batch.set(ruleRef, rule);
    }
    await batch.commit();
}

// ============ Users ============
export async function getActiveUsers() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('active', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getUserByEmail(email) {
    const userRef = doc(db, 'users', email);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
}

export async function updateUserRole(email, role) {
    const userRef = doc(db, 'users', email);
    await setDoc(userRef, { role }, { merge: true });
}

// ============ Admins ============
export async function getAdmins() {
    const adminsRef = collection(db, 'admins');
    const q = query(adminsRef, where('active', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addAdmin(email, name, createdBy) {
    const adminRef = doc(db, 'admins', email);
    await setDoc(adminRef, {
        email,
        name,
        active: true,
        createdAt: serverTimestamp(),
        createdBy,
    });

    // 同時更新 users 表的 role
    const userRef = doc(db, 'users', email);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        await setDoc(userRef, { role: 'admin' }, { merge: true });
    }
}

export async function removeAdmin(email) {
    const adminRef = doc(db, 'admins', email);
    await setDoc(adminRef, { active: false }, { merge: true });

    // 同時更新 users 表的 role
    const userRef = doc(db, 'users', email);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        await setDoc(userRef, { role: 'user' }, { merge: true });
    }
}

export async function deleteUser(email) {
    // 1. 停用帳號權限 (立即生效)
    const userRef = doc(db, 'users', email);
    await setDoc(userRef, { active: false }, { merge: true });

    const adminRef = doc(db, 'admins', email);
    await setDoc(adminRef, { active: false }, { merge: true });

    // 2. 搜尋並清理所有相關資料表紀錄
    // 我們使用 collectionGroup('entries') 來搜尋所有月份下的資料
    // 注意：這通常需要在 Firebase Console 建立 Collection Group 索引
    const refsToDelete = [];

    try {
        // 搜尋沒空紀錄與特殊需求 (皆使用 userId 欄位)
        const q1 = query(collectionGroup(db, 'entries'), where('userId', '==', email));
        const s1 = await getDocs(q1);
        s1.forEach(d => refsToDelete.push(d.ref));

        // 搜尋排班紀錄 (使用 assignedUserId 欄位)
        const q2 = query(collectionGroup(db, 'entries'), where('assignedUserId', '==', email));
        const s2 = await getDocs(q2);
        s2.forEach(d => refsToDelete.push(d.ref));
    } catch (error) {
        console.error('Error fetching historical data for deletion:', error);
        // 如果索引尚未建立，至少核心停權已完成，拋出錯誤讓 UI 提示
        throw new Error('帳號已停權，但部分歷史資料清理失敗（可能需要建立 Firebase 索引）。' + error.message);
    }

    // 分批執行刪除 (Firestore 每批上限 500 筆)
    for (let i = 0; i < refsToDelete.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = refsToDelete.slice(i, i + 500);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }
}

// ============ Unavailability ============
export async function getMyUnavailability(email, month) {
    const unavailRef = collection(db, 'unavailability', month, 'entries');
    const q = query(unavailRef, where('userId', '==', email));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getAllUnavailability(month) {
    const unavailRef = collection(db, 'unavailability', month, 'entries');
    const snapshot = await getDocs(unavailRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function saveMyUnavailability(email, month, selections) {
    // 先刪除該使用者該月所有舊資料
    const unavailRef = collection(db, 'unavailability', month, 'entries');
    const q = query(unavailRef, where('userId', '==', email));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));

    // 新增新資料
    const ts = new Date().toISOString();
    selections.forEach((sel, idx) => {
        const newRef = doc(unavailRef, `${email}_${sel.date}_${sel.ruleId}`);
        batch.set(newRef, {
            userId: email,
            date: sel.date,
            ruleId: sel.ruleId,
            ts,
        });
    });

    await batch.commit();
    return { success: true, count: selections.length, savedAt: ts };
}

// ============ Special Requests ============
export async function getMySpecialRequest(email, month) {
    const reqRef = doc(db, 'specialRequests', month, 'entries', email);
    const reqSnap = await getDoc(reqRef);
    return reqSnap.exists() ? reqSnap.data().text : '';
}

export async function getAllSpecialRequests(month, users) {
    const reqRef = collection(db, 'specialRequests', month, 'entries');
    const snapshot = await getDocs(reqRef);

    // 附加使用者名稱
    const userMap = {};
    users.forEach(u => userMap[u.email] = u.name);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            userId: doc.id,
            name: userMap[doc.id] || doc.id.split('@')[0],
            text: data.text,
            updatedAt: data.ts,
        };
    });
}

export async function saveSpecialRequest(email, month, text) {
    const reqRef = doc(db, 'specialRequests', month, 'entries', email);
    await setDoc(reqRef, {
        userId: email,
        month,
        text,
        ts: serverTimestamp(),
    });
}

// ============ Roster ============
export async function getRoster(month) {
    const rosterRef = collection(db, 'roster', month, 'entries');
    const snapshot = await getDocs(rosterRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function setRosterCell(month, date, ruleId, userId, assignedBy, options = {}) {
    const cellId = `${date}_${ruleId}`;
    const rosterRef = doc(db, 'roster', month, 'entries', cellId);

    if (!userId) {
        // 清除排班
        await deleteDoc(rosterRef);
        return { success: true, affectedCells: [{ date, ruleId, userId: null }] };
    }

    await setDoc(rosterRef, {
        date,
        ruleId,
        assignedUserId: userId,
        assignedBy,
        ts: serverTimestamp(),
    });

    const affectedCells = [{ date, ruleId, userId }];

    // 同日自動補齊（覆蓋 shiftIndex 之後的所有時段）
    if (options.autoFillSameDay && options.dayShifts) {
        const currentShiftIndex = options.shiftIndex ?? 0;
        const overwriteExisting = options.overwriteExisting ?? false;

        for (let i = 0; i < options.dayShifts.length; i++) {
            const shift = options.dayShifts[i];
            // 只處理當前點擊時段"之後"的時段
            if (i > currentShiftIndex && shift.ruleId !== ruleId) {
                const otherCellId = `${date}_${shift.ruleId}`;
                const otherRef = doc(db, 'roster', month, 'entries', otherCellId);

                // 檢查是否沒空
                const unavailRef = doc(db, 'unavailability', month, 'entries', `${userId}_${date}_${shift.ruleId}`);
                const unavailSnap = await getDoc(unavailRef);

                if (!unavailSnap.exists()) {
                    // 如果允許覆蓋，直接寫入
                    if (overwriteExisting) {
                        await setDoc(otherRef, {
                            date,
                            ruleId: shift.ruleId,
                            assignedUserId: userId,
                            assignedBy,
                            ts: serverTimestamp(),
                        });
                        affectedCells.push({ date, ruleId: shift.ruleId, userId });
                    } else {
                        // 只有在沒有人時才指派
                        const otherSnap = await getDoc(otherRef);
                        if (!otherSnap.exists()) {
                            await setDoc(otherRef, {
                                date,
                                ruleId: shift.ruleId,
                                assignedUserId: userId,
                                assignedBy,
                                ts: serverTimestamp(),
                            });
                            affectedCells.push({ date, ruleId: shift.ruleId, userId });
                        }
                    }
                }
            }
        }
    }

    return { success: true, affectedCells };
}

// ============ Workload ============
export function calculateHours(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);

    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;

    if (endMin <= startMin) {
        endMin += 24 * 60;
    }

    return (endMin - startMin) / 60;
}

export function getMonthlyWorkload(month, roster, shiftRules, users) {
    const ruleHours = {};
    shiftRules.forEach(r => {
        ruleHours[r.ruleId] = calculateHours(r.start, r.end);
    });

    const userMap = {};
    users.forEach(u => {
        userMap[u.email] = {
            name: u.name,
            hours: 0,
            shiftsCount: 0,
            dates: [],
        };
    });

    roster.forEach(r => {
        const userId = r.assignedUserId;
        if (!userId) return;

        if (!userMap[userId]) {
            userMap[userId] = {
                name: userId.split('@')[0],
                hours: 0,
                shiftsCount: 0,
                dates: [],
            };
        }

        const hours = ruleHours[r.ruleId] || 0;
        userMap[userId].hours += hours;
        userMap[userId].shiftsCount += 1;
        userMap[userId].dates.push(r.date);
    });

    return Object.keys(userMap)
        .filter(userId => userMap[userId].shiftsCount > 0)
        .map(userId => ({
            userId,
            name: userMap[userId].name,
            hours: userMap[userId].hours,
            shiftsCount: userMap[userId].shiftsCount,
            uniqueDays: [...new Set(userMap[userId].dates)].length,
        }))
        .sort((a, b) => b.hours - a.hours);
}

// ============ Month Model ============
export function getMonthModel(month, shiftRules) {
    const [year, mon] = month.split('-').map(Number);
    const firstDay = new Date(year, mon - 1, 1);
    const lastDay = new Date(year, mon, 0);

    const weekdayShifts = shiftRules.filter(r => r.appliesTo === 'weekday');
    const weekendShifts = shiftRules.filter(r => r.appliesTo === 'weekend');

    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const days = [];

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(year, mon - 1, d);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const shifts = isWeekend ? weekendShifts : weekdayShifts;

        days.push({
            date: dateStr,
            dayOfWeek,
            dayName: dayNames[dayOfWeek],
            isWeekend,
            shifts: shifts.map(s => ({
                ruleId: s.ruleId,
                label: `${s.start}~${s.end}`,
                start: s.start,
                end: s.end,
                hours: calculateHours(s.start, s.end),
            })),
        });
    }

    return { month, year, monthNum: mon, days };
}

// 取得月份的週次分組 (考慮日曆對齊)
export function getWeeksFromMonth(monthModel) {
    const weeks = [];
    let currentWeek = [];
    let previousDayOfWeek = -1;

    monthModel.days.forEach((day, index) => {
        // 如果是第一天且不是週日，需要在前面補空格
        if (index === 0 && day.dayOfWeek > 0) {
            for (let i = 0; i < day.dayOfWeek; i++) {
                currentWeek.push(null);
            }
        }

        // 如果新的一週開始（週日）且不是第一天
        if (day.dayOfWeek === 0 && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }

        currentWeek.push(day);
        previousDayOfWeek = day.dayOfWeek;
    });

    // 最後一週的處理
    if (currentWeek.length > 0) {
        // 補齊到 7 天（如果需要）
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }

    return weeks;
}
