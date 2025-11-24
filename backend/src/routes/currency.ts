import express from 'express';
import { getUSDRate } from '../services/currencyService';

const router = express.Router();

// Получить текущий курс доллара (публичный endpoint)
router.get('/rate', async (req, res) => {
  try {
    const rate = await getUSDRate();
    res.json({ rate, currency: 'USD', baseCurrency: 'RUB' });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Ошибка получения курса';
    console.error('Get rate error:', errorMessage, error);
    
    // Всегда возвращаем успешный ответ с дефолтным курсом, если есть ошибка
    const defaultRate = 90;
    res.json({ rate: defaultRate, currency: 'USD', baseCurrency: 'RUB', error: errorMessage });
  }
});

export default router;

