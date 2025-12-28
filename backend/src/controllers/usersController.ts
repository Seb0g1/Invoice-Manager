import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import telegramService from '../services/telegramService';

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    // Преобразуем _id в id для каждого пользователя
    const formattedUsers = users.map(user => ({
      id: user._id,
      login: user.login,
      role: user.role
    }));
    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { login, password, role } = req.body;

    if (!login || !password || !role) {
      return res.status(400).json({ message: 'Все поля обязательны' });
    }

    if (!['director', 'collector'].includes(role)) {
      return res.status(400).json({ message: 'Неверная роль' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      login: login.trim(),
      password: hashedPassword,
      role
    });

    await user.save();

    // Отправляем уведомление в Telegram
    try {
      const admin = await User.findById(req.userId);
      if (admin) {
        await telegramService.notifyUserCreated(admin.login, user.login, user.role);
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
    }

    res.status(201).json({
      id: user._id,
      login: user.login,
      role: user.role
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Пользователь с таким логином уже существует' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { login, password, role } = req.body;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Неверный ID пользователя' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Обновляем логин, если указан
    if (login && login.trim() !== user.login) {
      const existingUser = await User.findOne({ login: login.trim() });
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({ message: 'Пользователь с таким логином уже существует' });
      }
      user.login = login.trim();
    }

    // Обновляем пароль, если указан
    if (password && password.trim()) {
      user.password = await bcrypt.hash(password, 10);
    }

    // Обновляем роль, если указана
    if (role && ['director', 'collector'].includes(role)) {
      user.role = role;
    }

    await user.save();

    res.json({
      id: user._id,
      login: user.login,
      role: user.role
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Пользователь с таким логином уже существует' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { loginConfirm } = req.body;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Неверный ID пользователя' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Проверка подтверждения
    if (loginConfirm !== user.login) {
      return res.status(400).json({ message: 'Неверное подтверждение. Введите логин пользователя.' });
    }

    // Нельзя удалить самого себя
    if (req.userId === id) {
      return res.status(400).json({ message: 'Нельзя удалить самого себя' });
    }

    const deletedLogin = user.login;
    await User.findByIdAndDelete(id);

    // Отправляем уведомление в Telegram
    try {
      const admin = await User.findById(req.userId);
      if (admin) {
        await telegramService.notifyUserDeleted(admin.login, deletedLogin);
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
    }

    res.json({ message: 'Пользователь успешно удалён' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

