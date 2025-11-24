import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'director' | 'collector';
}

// Переменная для отладки (вместо global)
let authDebugLogged = false;

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;
    
    // Логирование для отладки (только первые несколько запросов)
    if (!authDebugLogged) {
      console.log('Auth middleware - cookies:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        allCookies: Object.keys(req.cookies),
        headers: req.headers.cookie ? 'present' : 'missing'
      });
      authDebugLogged = true;
      setTimeout(() => { authDebugLogged = false; }, 5000);
    }

    if (!token) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (typeof token !== 'string') {
      return res.status(401).json({ message: 'Невалидный формат токена' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string;
      role: 'director' | 'collector';
    };

    if (!decoded || !decoded.userId || !decoded.role) {
      return res.status(401).json({ message: 'Невалидный токен: отсутствуют данные' });
    }

    req.userId = decoded.userId.toString();
    req.userRole = decoded.role;
    next();
  } catch (error: any) {
    const errorMessage = error?.message || 'Невалидный токен';
    console.error('Auth middleware error:', errorMessage);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Невалидный токен' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истёк' });
    }
    
    return res.status(401).json({ message: 'Ошибка аутентификации' });
  }
};

export const roleMiddleware = (allowedRoles: ('director' | 'collector')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }

    next();
  };
};

