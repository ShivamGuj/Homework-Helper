import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

const handler = NextAuth({
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
            console.log("Authentication failed: No user found with email", credentials.email);
            throw new Error("No user found");
          }

          console.log("User found during authentication:", {
            id: user._id,
            email: user.email,
            hasPassword: !!user.password,
            passwordLength: user.password?.length
          });

          if (!user.password) {
            console.log("Authentication failed: User has no password stored");
            throw new Error("Password not set for this account");
          }

          const isPasswordMatch = await bcrypt.compare(credentials.password, user.password);
          console.log("Password comparison result:", {
            inputPasswordLength: credentials.password.length,
            storedPasswordLength: user.password.length,
            isMatch: isPasswordMatch
          });
          
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
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === 'development',
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
});

export { handler as GET, handler as POST };
