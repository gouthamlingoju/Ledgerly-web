import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Redirect to login on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && typeof window !== "undefined") {
            const path = window.location.pathname;
            if (path !== "/login" && path !== "/register") {
                localStorage.removeItem("token");
                window.location.href = "/login";
            }
        }
        return Promise.reject(err);
    }
);

export default api;

// --- Auth ---
export interface User {
    id: string;
    email: string;
    username: string | null;
    created_at: string | null;
}

export const authApi = {
    register: (email: string, username: string, password: string) =>
        api.post<{ access_token: string }>("/auth/register", { email, username, password }),
    login: (identifier: string, password: string) =>
        api.post<{ access_token: string }>("/auth/login", { identifier, password }),
    me: () => api.get<User>("/auth/me"),
};

// --- Contacts ---
export interface Contact {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    balance: number;
}

export const contactsApi = {
    list: () => api.get<Contact[]>("/contacts/"),
    get: (id: string) => api.get<Contact>(`/contacts/${id}`),
    create: (name: string) => api.post<Contact>("/contacts/", { name }),
    update: (id: string, name: string) => api.put<Contact>(`/contacts/${id}`, { name }),
    delete: (id: string) => api.delete(`/contacts/${id}`),
};

// --- Ledger Entries ---
export interface LedgerEntry {
    id: string;
    user_id: string;
    contact_id: string;
    direction: "credit" | "debit";
    amount: number;
    note: string | null;
    created_at: string;
    contact_name: string | null;
}

export interface Balance {
    contact_id: string;
    contact_name: string;
    balance: number;
    total_credit: number;
    total_debit: number;
}

export const ledgerApi = {
    listEntries: (contactId?: string) =>
        api.get<LedgerEntry[]>("/ledger/entries", {
            params: contactId ? { contact_id: contactId } : {},
        }),
    createEntry: (data: {
        contact_id: string;
        direction: "credit" | "debit";
        amount: number;
        note?: string;
    }) => api.post<LedgerEntry>("/ledger/entries", data),
    deleteEntry: (id: string) => api.delete(`/ledger/entries/${id}`),
    getBalance: (contactId: string) =>
        api.get<Balance>(`/ledger/balance/${contactId}`),
    getAllBalances: () => api.get<Balance[]>("/ledger/balances"),
};
