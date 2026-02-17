import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        await connectDB();

        const dbUser = await User.findOne({
          email: user.email?.toLowerCase(),
          isActive: true,
        });

        if (!dbUser) {
          return false;
        }

        // Guardar googleId y nombre en el primer login
        if (!dbUser.googleId && account?.providerAccountId) {
          dbUser.googleId = account.providerAccountId;
        }
        if (user.name && !dbUser.name) {
          dbUser.name = user.name;
        }
        await dbUser.save();

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    async jwt({ token }) {
      if (token.email && !token.dbId) {
        try {
          await connectDB();
          const dbUser = await User.findOne({
            email: token.email.toLowerCase(),
            isActive: true,
          });
          if (dbUser) {
            token.dbId = dbUser._id.toString();
          }
        } catch (error) {
          console.error("Error in jwt callback:", error);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.dbId = token.dbId || "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
