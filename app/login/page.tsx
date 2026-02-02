import { signIn } from "@/auth";
import Link from "next/link";
import { AuthError } from "next-auth"; 
import { redirect } from "next/navigation";

// 1. Add 'searchParams' to read the error from the URL
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params?.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Sign In
        </h2>

        {/* 2. Show Red Error Box if login fails */}
        {errorMessage && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg text-center">
            {errorMessage === "CredentialsSignin"
              ? "Invalid Email or Password"
              : "Login Failed. Please try again."}
          </div>
        )}

        <form
          action={async (formData) => {
            "use server";
            try {
              // 3. Attempt Login
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/", // Force redirect to Home on success
              });
            } catch (error) {
              // 4. HANDLING THE REDIRECT (Success Case)
              // Next.js throws a "NEXT_REDIRECT" error to change pages.
              // We MUST re-throw it so the user actually goes to the home page.
              if (`${error}`.includes("NEXT_REDIRECT")) {
                throw error;
              }

              // 5. HANDLING LOGIN ERRORS (Failure Case)
              if (error instanceof AuthError) {
                switch (error.type) {
                  case "CredentialsSignin":
                  case "CallbackRouteError":
                    // Redirect back to login page with an error flag
                    redirect("/login?error=CredentialsSignin");
                  default:
                    redirect("/login?error=Default");
                }
              }

              // Re-throw any other unknown bugs
              throw error;
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition">
            Log In
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}