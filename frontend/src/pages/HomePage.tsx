import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      navigate(user ? "/dashboard" : "/login", { replace: true });
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl animate-pulse">
          📒
        </div>
      </div>
    </div>
  );
}