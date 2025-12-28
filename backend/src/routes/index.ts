import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import * as authController from '../controllers/authController';
import * as suppliersController from '../controllers/suppliersController';
import * as invoicesController from '../controllers/invoicesController';
import * as usersController from '../controllers/usersController';
import * as pickingListController from '../controllers/pickingListController';
import * as warehouseController from '../controllers/warehouseController';
import * as ozonController from '../controllers/ozonController';
import * as yandexController from '../controllers/yandexController';
import * as yandexMarketController from '../controllers/yandexMarketController';
import * as yandexMarketGoController from '../controllers/yandexMarketGoController';
import * as yandexMarketBulkController from '../controllers/yandexMarketBulkController';
import * as yandexBusinessController from '../controllers/yandexBusinessController';
import * as yandexMarketStatsController from '../controllers/yandexMarketStatsController';
import * as settingsController from '../controllers/settingsController';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Создаём директорию для загрузок, если её нет
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки фото
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Настройка multer для загрузки Excel файлов (в памяти)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.mimetype === 'application/vnd.ms-excel' ||
                     file.mimetype === 'application/octet-stream';

    if ((mimetype || extname) && allowedTypes.test(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только Excel файлы (.xlsx, .xls)'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Auth routes
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authMiddleware, authController.getMe);

// Suppliers routes
router.get('/suppliers', authMiddleware, suppliersController.getSuppliers);
router.get('/suppliers/:id', authMiddleware, suppliersController.getSupplierById); // Доступ для всех авторизованных
router.post('/suppliers', authMiddleware, roleMiddleware(['director']), suppliersController.createSupplier); // Создание только для директора
router.put('/suppliers/:id/pay', authMiddleware, roleMiddleware(['director']), suppliersController.payInvoices);
router.delete('/suppliers/:id', authMiddleware, roleMiddleware(['director']), suppliersController.deleteSupplier);

// Invoices routes
router.get('/invoices', authMiddleware, invoicesController.getInvoices);
router.get('/invoices/statistics', authMiddleware, invoicesController.getInvoiceStatistics);
router.post('/invoices', authMiddleware, upload.single('photo'), invoicesController.createInvoice);
router.delete('/invoices/:id', authMiddleware, roleMiddleware(['director']), invoicesController.deleteInvoice);

// Users routes (только для директора)
router.get('/users', authMiddleware, roleMiddleware(['director']), usersController.getUsers);
router.post('/users', authMiddleware, roleMiddleware(['director']), usersController.createUser);
router.put('/users/:id', authMiddleware, roleMiddleware(['director']), usersController.updateUser);
router.delete('/users/:id', authMiddleware, roleMiddleware(['director']), usersController.deleteUser);

// Picking Lists routes
router.get('/picking-lists', authMiddleware, pickingListController.getPickingLists);
router.get('/picking-lists/:id/export', authMiddleware, pickingListController.exportPickingList);
router.get('/picking-lists/:id', authMiddleware, pickingListController.getPickingListById);
router.post('/picking-lists', authMiddleware, pickingListController.createPickingList);
router.post('/picking-lists/import', authMiddleware, excelUpload.single('file'), pickingListController.importExcel);
router.post('/picking-list-items', authMiddleware, pickingListController.createPickingListItem);
router.put('/picking-list-items/:id', authMiddleware, pickingListController.updatePickingListItem);
router.delete('/picking-list-items/:id', authMiddleware, pickingListController.deletePickingListItem);
router.delete('/picking-lists/:id', authMiddleware, pickingListController.deletePickingList);

// Warehouse routes
// ВАЖНО: Специфичные роуты должны быть ПЕРЕД роутами с параметрами (:id)
router.get('/warehouse', authMiddleware, warehouseController.getWarehouseItems);
router.get('/warehouse/ids', authMiddleware, warehouseController.getAllWarehouseItemIds);
router.get('/warehouse/categories', authMiddleware, warehouseController.getCategories);
router.get('/warehouse/low-stock', authMiddleware, warehouseController.getLowStockItems);
router.get('/warehouse/export', authMiddleware, warehouseController.exportWarehouseItems);
router.post('/warehouse/import', authMiddleware, excelUpload.single('excelFile'), warehouseController.importWarehouseItems);
router.post('/warehouse', authMiddleware, warehouseController.createWarehouseItem);
router.delete('/warehouse', authMiddleware, warehouseController.deleteWarehouseItems);
// Роуты с параметрами должны быть в конце
router.get('/warehouse/:id', authMiddleware, warehouseController.getWarehouseItemById);
router.put('/warehouse/:id', authMiddleware, warehouseController.updateWarehouseItem);
router.delete('/warehouse/:id', authMiddleware, warehouseController.deleteWarehouseItem);

// OZON routes
router.get('/ozon/config', authMiddleware, roleMiddleware(['director']), ozonController.getOzonConfig);
router.put('/ozon/config', authMiddleware, roleMiddleware(['director']), ozonController.updateOzonConfig);
router.post('/ozon/test', authMiddleware, roleMiddleware(['director']), ozonController.testOzonConnection);
router.get('/ozon/products', authMiddleware, ozonController.getOzonProducts);
router.get('/ozon/products/info', authMiddleware, ozonController.getOzonProductInfo);
router.post('/ozon/products/attributes', authMiddleware, ozonController.getOzonProductAttributes);
router.post('/ozon/products/pictures', authMiddleware, ozonController.getOzonProductPictures);
router.post('/ozon/products/stocks', authMiddleware, ozonController.getOzonProductStocks);
router.post('/ozon/products/stocks-by-warehouse', authMiddleware, ozonController.getOzonStocksByWarehouse);
router.post('/ozon/products/warehouse-stocks', authMiddleware, ozonController.getOzonWarehouseStocks);
router.post('/ozon/products/update-prices', authMiddleware, ozonController.updateOzonPrices);
router.post('/ozon/products/update-price-timer', authMiddleware, ozonController.updateOzonPriceTimer);
router.get('/ozon/sync', authMiddleware, roleMiddleware(['director']), ozonController.syncOzonProducts);
router.get('/ozon/sync/progress', authMiddleware, roleMiddleware(['director']), ozonController.getSyncProgress);
router.post('/ozon/chats', authMiddleware, ozonController.getOzonChats);
router.post('/ozon/chats/history', authMiddleware, ozonController.getOzonChatHistory);
router.post('/ozon/chats/send-message', authMiddleware, ozonController.sendOzonChatMessage);
router.post('/ozon/chats/start', authMiddleware, ozonController.startOzonChat);
router.post('/ozon/chats/read', authMiddleware, ozonController.markOzonChatAsRead);
router.post('/ozon/chats/send-file', authMiddleware, ozonController.sendFileToOzonChat);
router.post('/ozon/analytics/data', authMiddleware, ozonController.getOzonAnalytics);
router.post('/ozon/analytics/product-queries', authMiddleware, ozonController.getOzonProductQueries);
router.post('/ozon/analytics/product-queries/details', authMiddleware, ozonController.getOzonProductQueriesDetails);
router.post('/ozon/finance/realization', authMiddleware, ozonController.getOzonRealizationByDay);
router.post('/ozon/search-queries/text', authMiddleware, ozonController.searchOzonQueriesByText);
router.get('/ozon/search-queries/top', authMiddleware, ozonController.getOzonTopSearchQueries);

// Yandex Market routes
router.get('/yandex/accounts', authMiddleware, roleMiddleware(['director']), yandexController.getYandexAccounts);
router.get('/yandex/accounts/:id', authMiddleware, roleMiddleware(['director']), yandexController.getYandexAccountById);
router.post('/yandex/accounts', authMiddleware, roleMiddleware(['director']), yandexController.createYandexAccount);
router.put('/yandex/accounts/:id', authMiddleware, roleMiddleware(['director']), yandexController.updateYandexAccount);
router.delete('/yandex/accounts/:id', authMiddleware, roleMiddleware(['director']), yandexController.deleteYandexAccount);
router.post('/yandex/test', authMiddleware, roleMiddleware(['director']), yandexController.testYandexConnection);
router.get('/yandex/products', authMiddleware, yandexController.getYandexProducts);
router.post('/yandex/sync', authMiddleware, roleMiddleware(['director']), yandexController.syncYandexProducts);

// Yandex Market Partner API routes (новая система управления товарами)
// Управление бизнесами
router.get('/yandex-market/businesses', authMiddleware, roleMiddleware(['director']), yandexBusinessController.getBusinesses);
router.get('/yandex-market/businesses/:id', authMiddleware, roleMiddleware(['director']), yandexBusinessController.getBusinessById);
router.post('/yandex-market/businesses', authMiddleware, roleMiddleware(['director']), yandexBusinessController.createBusiness);
router.put('/yandex-market/businesses/:id', authMiddleware, roleMiddleware(['director']), yandexBusinessController.updateBusiness);
router.delete('/yandex-market/businesses/:id', authMiddleware, roleMiddleware(['director']), yandexBusinessController.deleteBusiness);
router.post('/yandex-market/businesses/:id/test', authMiddleware, roleMiddleware(['director']), yandexBusinessController.testBusinessConnection);

// Синхронизация (Market Yandex Go)
router.post('/yandex-market-go/sync/products', authMiddleware, roleMiddleware(['director']), yandexMarketGoController.syncAllProducts);
router.get('/yandex-market-go/sync/progress', authMiddleware, roleMiddleware(['director']), yandexMarketGoController.getSyncProgress);
router.post('/yandex-market-go/sync/stocks', authMiddleware, roleMiddleware(['director']), yandexMarketGoController.syncStocks);
router.post('/yandex-market-go/sync/prices', authMiddleware, roleMiddleware(['director']), yandexMarketGoController.syncPrices);

// Синхронизация (старый API - для совместимости)
router.post('/yandex-market/sync/products', authMiddleware, roleMiddleware(['director']), yandexMarketController.syncAllProducts);
router.post('/yandex-market/sync/stocks', authMiddleware, roleMiddleware(['director']), yandexMarketController.syncStocks);
router.post('/yandex-market/sync/prices', authMiddleware, roleMiddleware(['director']), yandexMarketController.syncPrices);

// Работа с товарами (Market Yandex Go)
router.get('/yandex-market-go/businesses', authMiddleware, yandexBusinessController.getBusinesses);
router.get('/yandex-market-go/products', authMiddleware, yandexMarketGoController.getAllProducts);
router.get('/yandex-market-go/products/search', authMiddleware, yandexMarketGoController.searchProducts);
router.get('/yandex-market-go/products/:vendorCode', authMiddleware, yandexMarketGoController.getProductByVendorCode);
router.get('/yandex-market-go/businesses/:businessId/products', authMiddleware, yandexMarketGoController.getBusinessProducts);
router.post('/yandex-market-go/products/update-price', authMiddleware, roleMiddleware(['director']), yandexMarketGoController.updatePriceInAllBusinesses);
router.post('/yandex-market-go/products/update-name', authMiddleware, roleMiddleware(['director']), yandexMarketGoController.updateProductName);

// Работа с товарами (старый API - для совместимости)
router.get('/yandex-market/products', authMiddleware, yandexMarketController.getAllProducts);
router.get('/yandex-market/products/search', authMiddleware, yandexMarketController.searchProducts);
router.get('/yandex-market/products/:vendorCode', authMiddleware, yandexMarketController.getProductByVendorCode);
router.post('/yandex-market/products/update-price', authMiddleware, roleMiddleware(['director']), yandexMarketController.updatePriceInAllBusinesses);
router.post('/yandex-market/products/bulk-update-prices', authMiddleware, roleMiddleware(['director']), yandexMarketBulkController.bulkUpdatePrices);

// Статистика
router.get('/yandex-market/stats', authMiddleware, yandexMarketStatsController.getStats);

// Settings routes
router.get('/settings', authMiddleware, settingsController.getSettings); // Чтение доступно всем для проверки прав доступа
router.put('/settings', authMiddleware, roleMiddleware(['director']), settingsController.updateSettings); // Изменение только для директора
router.post('/settings/telegram/test', authMiddleware, roleMiddleware(['director']), settingsController.testTelegramConnection);

// Currency routes
import currencyRoutes from './currency';
router.use('/currency', currencyRoutes);

export default router;

