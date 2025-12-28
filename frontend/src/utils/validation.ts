import * as yup from 'yup';

// Схема валидации для товара на складе
export const warehouseItemSchema = yup.object({
  name: yup
    .string()
    .required('Наименование товара обязательно')
    .min(2, 'Наименование должно содержать минимум 2 символа')
    .max(200, 'Наименование не должно превышать 200 символов')
    .trim(),
  quantity: yup
    .number()
    .nullable()
    .transform((value: any, originalValue: any) => {
      // Преобразуем пустую строку в null
      if (originalValue === '' || originalValue === null || originalValue === undefined) {
        return null;
      }
      return value;
    })
    .min(0, 'Количество не может быть отрицательным')
    .max(1000000, 'Количество слишком большое'),
  article: yup
    .string()
    .nullable()
    .max(100, 'Артикул не должен превышать 100 символов')
    .transform((value: any) => value || null),
  price: yup
    .number()
    .nullable()
    .transform((value: any, originalValue: any) => {
      // Преобразуем пустую строку в null
      if (originalValue === '' || originalValue === null || originalValue === undefined) {
        return null;
      }
      return value;
    })
    .min(0, 'Цена не может быть отрицательной')
    .max(10000000, 'Цена слишком большая'),
  category: yup
    .string()
    .nullable()
    .max(100, 'Категория не должна превышать 100 символов')
    .transform((value: any) => value || null),
  lowStockThreshold: yup
    .number()
    .nullable()
    .transform((value: any, originalValue: any) => {
      if (originalValue === '' || originalValue === null || originalValue === undefined) {
        return null;
      }
      return value;
    })
    .min(0, 'Порог остатка не может быть отрицательным')
    .max(1000000, 'Порог остатка слишком большой')
});

export type WarehouseItemFormData = yup.InferType<typeof warehouseItemSchema>;

// Схема валидации для накладной
export const invoiceSchema = yup.object({
  supplier: yup.string().required('Поставщик обязателен'),
  amount: yup
    .number()
    .required('Сумма обязательна')
    .min(0.01, 'Сумма должна быть больше 0')
    .max(10000000, 'Сумма слишком большая'),
  currency: yup.string().oneOf(['RUB', 'USD'], 'Неверная валюта').required('Валюта обязательна'),
  type: yup.string().oneOf(['income', 'return'], 'Неверный тип накладной').required('Тип обязателен'),
  date: yup.date().required('Дата обязательна')
});

export type InvoiceFormData = yup.InferType<typeof invoiceSchema>;

// Схема валидации для поставщика
export const supplierSchema = yup.object({
  name: yup
    .string()
    .required('Название поставщика обязательно')
    .min(2, 'Название должно содержать минимум 2 символа')
    .max(200, 'Название не должно превышать 200 символов')
    .trim()
});

export type SupplierFormData = yup.InferType<typeof supplierSchema>;

// Схема валидации для пользователя
export const userSchema = yup.object({
  login: yup
    .string()
    .required('Логин обязателен')
    .min(3, 'Логин должен содержать минимум 3 символа')
    .max(50, 'Логин не должен превышать 50 символов')
    .matches(/^[a-zA-Z0-9_]+$/, 'Логин может содержать только буквы, цифры и подчеркивание'),
  password: yup
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(100, 'Пароль не должен превышать 100 символов'),
  role: yup.string().oneOf(['director', 'collector'], 'Неверная роль').required('Роль обязательна')
});

export type UserFormData = yup.InferType<typeof userSchema>;

