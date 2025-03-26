import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('Please provide process.env.NEXTAUTH_SECRET');
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter all fields");
        }

        try {
          await connectDB();
          
          const user = await User.findOne({ email: credentials.email });
          if (!user) {
            throw new Error("No user found");
          }

          const isPasswordMatch = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordMatch) {
            throw new Error("Invalid credentials");
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        } catch (error) {
          console.error("Auth error:", error);
          throw error;
        }
      }
    })
  ],
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};
