// Сервис для получения курса валют от ЦБ РФ
import axios from 'axios';

interface CBRResponse {
  Valute: {
    USD: {
      Value: number;
      Previous: number;
    };
  };
}

let cachedRate: { rate: number; date: string } | null = null;

export const getUSDRate = async (): Promise<number> => {
  try {
    // Проверяем кэш (обновляем раз в день)
    const today = new Date().toISOString().split('T')[0];
    if (cachedRate && cachedRate.date === today) {
      return cachedRate.rate;
    }

    // Получаем курс от ЦБ РФ
    const response = await axios.get<CBRResponse>('https://www.cbr-xml-daily.ru/daily_json.js', {
      timeout: 10000,
      validateStatus: (status) => status === 200,
    });
    
    if (!response || !response.data) {
      throw new Error('Пустой ответ от API ЦБ РФ');
    }
    
    const data = response.data;
    
    if (!data || !data.Valute || !data.Valute.USD) {
      throw new Error('Неверный формат ответа от API ЦБ РФ: отсутствует USD');
    }
    
    if (typeof data.Valute.USD.Value !== 'number' || isNaN(data.Valute.USD.Value)) {
      throw new Error('Неверный формат курса USD от API ЦБ РФ');
    }
    
    const rate = data.Valute.USD.Value;
    
    if (rate <= 0 || rate > 1000) {
      throw new Error(`Некорректное значение курса: ${rate}`);
    }
    
    // Кэшируем
    cachedRate = { rate, date: today };
    
    return rate;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка';
    console.error('Ошибка получения курса валют:', errorMessage);
    
    // Возвращаем последний кэшированный курс или дефолтный
    if (cachedRate) {
      console.log('Используется кэшированный курс:', cachedRate.rate);
      return cachedRate.rate;
    }
    
    // Дефолтный курс если нет кэша
    const defaultRate = 90;
    console.log('Используется дефолтный курс:', defaultRate);
    cachedRate = { rate: defaultRate, date: new Date().toISOString().split('T')[0] };
    return defaultRate;
  }
};

export const convertUSDtoRUB = async (usd: number): Promise<number> => {
  const rate = await getUSDRate();
  return usd * rate;
};

export const convertRUBtoUSD = async (rub: number): Promise<number> => {
  const rate = await getUSDRate();
  return rub / rate;
};

