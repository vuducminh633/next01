import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" }, // ⚠️ This handles the "Simple Session Management"
  pages: {
    signIn: "/login", // Redirect here if they aren't logged in
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 1. Fetch user from DB
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string));

        // 2. Check if user exists and has a password
        if (!user || !user.password) {
          throw new Error("User not found.");
        }

        // 3. Verify Password (Hash vs Salt)
        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordsMatch) {
          throw new Error("Invalid password.");
        }

        // 4. Return user info (Login Success!)
        return user;
      },
    }),
  ],
});