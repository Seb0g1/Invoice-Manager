import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export const login = async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Логин и пароль обязательны' });
    }

    const user = await User.findOne({ login });
    if (!user) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    // Настройки cookies
    const cookieOptions: any = {
      httpOnly: true,
      secure: process.env.FRONTEND_URL?.startsWith('https://') || false,
      sameSite: process.env.FRONTEND_URL?.startsWith('https://') ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    };
    
    // Устанавливаем domain только если указан явно
    if (process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    
    res.cookie('token', token, cookieOptions);
    
    // Логирование для отладки
    console.log('Cookie установлена:', {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      domain: cookieOptions.domain || 'не указан',
      path: cookieOptions.path
    });

    res.json({
      message: 'Успешный вход',
      user: {
        id: user._id,
        login: user.login,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Выход выполнен' });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    // Проверяем, что userId является валидным ObjectId
    if (typeof req.userId !== 'string' || req.userId.length !== 24) {
      console.error('Invalid userId format:', req.userId);
      return res.status(401).json({ message: 'Невалидный идентификатор пользователя' });
    }

    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    res.json({
      id: user._id,
      login: user.login,
      role: user.role
    });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Ошибка сервера';
    console.error('Get me error:', errorMessage, error);
    res.status(500).json({ message: errorMessage });
  }
};

