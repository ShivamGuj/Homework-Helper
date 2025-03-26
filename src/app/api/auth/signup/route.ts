import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Please fill in all fields' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    try {
      await connectDB();
    } catch (error) {
      console.error('Database connection error:', error);
      return NextResponse.json(
        { message: 'Database connection failed' },
        { status: 500 }
      );
    }

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json(
          { message: 'User already exists' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('User lookup error:', error);
      return NextResponse.json(
        { message: 'Error checking existing user' },
        { status: 500 }
      );
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
      });

      return NextResponse.json(
        { 
          message: 'User created successfully',
          userId: user._id,
          name: user.name,
          email: user.email
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('User creation error:', error);
      return NextResponse.json(
        { message: 'Error creating user' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Signup route error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
