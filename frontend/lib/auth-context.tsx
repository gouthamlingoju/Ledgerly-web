"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, type User } from "@/lib/api";

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        try {
            const res = await authApi.me();
            setUser(res.data);
        } catch {
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const savedToken = localStorage.getItem("token");
        if (savedToken) {
            setToken(savedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchUser().finally(() => setIsLoading(false));
        }
    }, [token, fetchUser]);

    const login = async (newToken: string) => {
        localStorage.setItem("token", newToken);
        setToken(newToken);
        setIsLoading(true);
        try {
            const res = await authApi.me();
            setUser(res.data);
        } catch {
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
