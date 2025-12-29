import { createContext, useContext, useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
