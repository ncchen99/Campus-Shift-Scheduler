import { createContext, useContext, useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    deleteUser as firebaseDeleteUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsNameSetup, setNeedsNameSetup] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // 載入使用者資料
                await loadUserProfile(firebaseUser.email);
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loadUserProfile = async (email) => {
        try {
            const userRef = doc(db, 'users', email);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                setUserProfile(data);
                setNeedsNameSetup(false);
            } else {
                // 新使用者，需要設定名稱
                setNeedsNameSetup(true);
                setUserProfile(null);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    };

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setUserProfile(null);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    const setupUserName = async (name) => {
        if (!user) return;

        try {
            const userRef = doc(db, 'users', user.email);
            const userData = {
                email: user.email,
                name: name,
                role: 'user',
                active: true,
                createdAt: serverTimestamp(),
            };

            await setDoc(userRef, userData);
            setUserProfile(userData);
            setNeedsNameSetup(false);
        } catch (error) {
            console.error('Error setting up user name:', error);
            throw error;
        }
    };

    // 檢查暱稱是否已被其他使用者使用
    const checkNameExists = async (name) => {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('name', '==', name), where('active', '==', true));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return { exists: false };
            }

            // 檢查是否是同一個使用者（排除自己）
            const currentEmail = user?.email;
            const matchedUser = snapshot.docs.find(doc => doc.id !== currentEmail);
            if (matchedUser) {
                // 隱藏部分 email 以保護隱私
                const email = matchedUser.id;
                const maskedEmail = email.substring(0, 3) + '***' + email.substring(email.indexOf('@'));
                return { exists: true, email: maskedEmail, fullEmail: email };
            }

            return { exists: false };
        } catch (error) {
            console.error('Error checking name exists:', error);
            throw error;
        }
    };

    // 刪除當前使用者帳號並登出（用於暱稱重複時）
    const deleteCurrentUserAndSignOut = async () => {
        if (!user) return;

        try {
            // 1. 刪除 Firestore 中的使用者資料
            const userRef = doc(db, 'users', user.email);
            await deleteDoc(userRef);

            // 2. 刪除 Firebase Auth 帳號
            await firebaseDeleteUser(user);

            // 3. 重置狀態
            setUser(null);
            setUserProfile(null);
            setNeedsNameSetup(false);
        } catch (error) {
            console.error('Error deleting user:', error);
            // 如果刪除 Auth 帳號失敗（可能需要重新登入），至少登出
            try {
                await firebaseSignOut(auth);
                setUser(null);
                setUserProfile(null);
            } catch (signOutError) {
                console.error('Error signing out after failed delete:', signOutError);
            }
            throw error;
        }
    };

    // 檢查是否為班長或管理員
    const isLeader = userProfile?.role === 'leader' || userProfile?.role === 'admin';
    const isAdmin = userProfile?.role === 'admin';

    const value = {
        user,
        userProfile,
        loading,
        needsNameSetup,
        isLeader,
        isAdmin,
        signInWithGoogle,
        signOut,
        setupUserName,
        loadUserProfile,
        checkNameExists,
        deleteCurrentUserAndSignOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
