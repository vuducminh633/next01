import { signIn, signOut } from "@/auth" 
import Link from "next/link";

export function SignIn() {
  return (
    <Link href="/login">
      <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium">
        Sign In
      </button>
    </Link>
  );
}

export function GoogleSignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <button className="flex w-full items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition font-medium">
        Sign in with Google
      </button>
    </form>
  );
}

export function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">
        Sign Out
      </button>
    </form>
  );
}