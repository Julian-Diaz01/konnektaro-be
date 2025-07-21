import { JwtPayload } from 'jsonwebtoken'; // Import for proper type definitions
import jwt from 'jsonwebtoken'
import { Request } from 'express';

export const isAdmin = (req: Request): boolean => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        console.error('Admin check failed: No token provided.');
        return false;
    }

    try {
        const decodedToken = jwt.decode(token) as JwtPayload | null;

        if (!decodedToken) {
            console.error('Invalid token structure.');
            return false;
        }

        const emailVerified = decodedToken.email_verified;

        return emailVerified === true;
    } catch (error: unknown) {
        if (error instanceof Error) {
            // Safely access error messages and properties
            console.error(`Error decoding token: ${error.message}`, error.stack);
        } else {
            console.error('Unknown error occurred');
        }
        return false;
    }
};