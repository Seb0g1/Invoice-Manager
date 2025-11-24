import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  CircularProgress,
  InputAdornment,
  IconButton,
  useMediaQuery,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Avatar
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Chat as ChatIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Add as AddIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface OzonChat {
  chat: {
    chat_id: string;
    chat_status: string;
    chat_type: string;
    created_at: string;
  };
  unread_count: number;
  first_unread_message_id?: string;
  last_message_id?: string;
}

interface OzonMessage {
  message_id: number;
  text: string;
  author: {
    id: string;
    name: string;
  };
  created_at: string;
}

const OzonChats: React.FC = () => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [chats, setChats] = useState<OzonChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<OzonChat | null>(null);
  const [messages, setMessages] = useState<OzonMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [createChatDialogOpen, setCreateChatDialogOpen] = useState(false);
  const [postingNumber, setPostingNumber] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async (loadMore: boolean = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
      }
      const response = await api.post('/ozon/chats', {
        filter: {
          chat_status: 'Opened',
          unread_only: false,
        },
        limit: 30,
        cursor: loadMore ? cursor : undefined,
      });

      if (loadMore) {
        setChats((prev) => [...prev, ...response.data.chats]);
      } else {
        setChats(response.data.chats);
      }
      setCursor(response.data.cursor);
      setHasMore(response.data.has_next || false);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Ошибка при загрузке чатов OZON';
      if (error.response?.status === 403 || errorMessage.includes('Premium') || errorMessage.includes('missing a required role')) {
        toast.error('Чаты с покупателями доступны только для продавцов с подпиской Premium Plus или Premium Pro. Обновите подписку в личном кабинете OZON.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchChatHistory = async (chatId: string) => {
    try {
      setLoadingMessages(true);
      const response = await api.post('/ozon/chats/history', {
        chatId,
        limit: 50,
        direction: 'Backward',
      });

      setMessages(response.data.messages || []);
      
      // Отмечаем сообщения как прочитанные
      if (response.data.messages && response.data.messages.length > 0) {
        const lastMessageId = response.data.messages[0].message_id;
        try {
          await api.post('/ozon/chats/read', {
            chatId,
            fromMessageId: lastMessageId,
          });
        } catch (error) {
          // Игнорируем ошибки при отметке прочитанными
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при загрузке истории чата');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !messageText.trim()) return;

    try {
      setSendingMessage(true);
      await api.post('/ozon/chats/send-message', {
        chatId: selectedChat.chat.chat_id,
        text: messageText.trim(),
      });
      
      toast.success('Сообщение отправлено');
      setMessageText('');
      fetchChatHistory(selectedChat.chat.chat_id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при отправке сообщения');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateChat = async () => {
    if (!postingNumber.trim()) {
      toast.error('Введите номер отправления');
      return;
    }

    try {
      setCreatingChat(true);
      const response = await api.post('/ozon/chats/start', {
        postingNumber: postingNumber.trim(),
      });
      
      toast.success('Чат создан');
      setPostingNumber('');
      setCreateChatDialogOpen(false);
      fetchChats(); // Обновляем список чатов
      
      // Открываем созданный чат
      if (response.data.result?.chat_id) {
        const newChat = chats.find(c => c.chat.chat_id === response.data.result.chat_id);
        if (newChat) {
          handleSelectChat(newChat);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при создании чата');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleSelectChat = (chat: OzonChat) => {
    setSelectedChat(chat);
    setChatDialogOpen(true);
    fetchChatHistory(chat.chat.chat_id);
  };

  const handleSendFile = async (file: File) => {
    if (!selectedChat) return;

    try {
      setSending(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await api.post('/ozon/chats/send-file', {
          chatId: selectedChat.chat.chat_id,
          base64Content: base64,
          fileName: file.name,
        });
        toast.success('Файл отправлен');
        fetchChatHistory(selectedChat.chat.chat_id);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при отправке файла');
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      chat.chat.chat_id.toLowerCase().includes(searchLower) ||
      chat.chat.chat_type.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Чаты с покупателями OZON
        </Typography>
        <Button
          variant="contained"
          onClick={() => setCreateChatDialogOpen(true)}
          startIcon={<AddIcon />}
          size={isMobile ? "large" : "medium"}
          sx={{ minHeight: { xs: 44, sm: 'auto' } }}
        >
          Создать чат
        </Button>
      </Box>

      <TextField
        fullWidth
        label="Поиск чатов"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton onClick={() => setSearchTerm('')} edge="end" size="small">
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
          style: { textTransform: 'none' }
        }}
        inputProps={{
          style: { textTransform: 'none' }
        }}
      />

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Paper>
            <List>
              {filteredChats.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="Чаты не найдены"
                    secondary="Нет открытых чатов с покупателями"
                  />
                </ListItem>
              ) : (
                filteredChats.map((chat) => (
                  <ListItem key={chat.chat.chat_id} disablePadding>
                    <ListItemButton onClick={() => handleSelectChat(chat)}>
                      <ListItemIcon>
                        <Avatar>
                          <ChatIcon />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {chat.chat.chat_type === 'Buyer_Seller' ? 'Чат с покупателем' : chat.chat.chat_type}
                            </Typography>
                            {chat.unread_count > 0 && (
                              <Chip
                                label={chat.unread_count}
                                size="small"
                                color="error"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Статус: {chat.chat.chat_status} | Создан: {new Date(chat.chat.created_at).toLocaleString('ru-RU')}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          </Paper>

          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => fetchChats(true)}
                disabled={loading}
                size={isMobile ? "large" : "medium"}
              >
                {loading ? <CircularProgress size={24} /> : 'Загрузить еще'}
              </Button>
            </Box>
          )}
        </>
      )}

      <Dialog
        open={chatDialogOpen}
        onClose={() => {
          setChatDialogOpen(false);
          setSelectedChat(null);
          setMessages([]);
        }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {selectedChat?.chat.chat_type === 'Buyer_Seller' ? 'Чат с покупателем' : 'Чат'}
        </DialogTitle>
        <DialogContent>
          {loadingMessages ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ maxHeight: { xs: '40vh', sm: '50vh' }, overflowY: 'auto', mb: 2 }}>
                {messages.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Нет сообщений
                  </Typography>
                ) : (
                  messages.map((message, index) => (
                    <Box key={message.message_id} sx={{ mb: 2 }}>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: { xs: 0.5, sm: 1 }, 
                        mb: 0.5 
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                          {message.author?.name || 'Пользователь'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                          {new Date(message.created_at).toLocaleString('ru-RU')}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{message.text || 'Нет текста'}</Typography>
                      {index < messages.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                  ))
                )}
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  label="Введите сообщение"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  size="small"
                  disabled={sendingMessage || !selectedChat}
                  inputProps={{
                    style: { textTransform: 'none' },
                    maxLength: 1000
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !selectedChat || !messageText.trim()}
                  startIcon={sendingMessage ? <CircularProgress size={20} /> : <SendIcon />}
                  size={isMobile ? "large" : "medium"}
                  sx={{ minHeight: { xs: 44, sm: 'auto' } }}
                >
                  Отправить
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
          <input
            type="file"
            id="file-input"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleSendFile(file);
              }
            }}
          />
          <label htmlFor="file-input" style={{ width: isMobile ? '100%' : 'auto' }}>
            <Button
              component="span"
              startIcon={<AttachFileIcon />}
              disabled={sending || !selectedChat}
              size={isMobile ? "large" : "medium"}
              fullWidth={isMobile}
              sx={{ minHeight: { xs: 44, sm: 'auto' } }}
            >
              Прикрепить файл
            </Button>
          </label>
          <Button
            onClick={() => {
              setChatDialogOpen(false);
              setSelectedChat(null);
              setMessages([]);
              setMessageText('');
            }}
            size={isMobile ? "large" : "medium"}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания нового чата */}
      <Dialog
        open={createChatDialogOpen}
        onClose={() => {
          setCreateChatDialogOpen(false);
          setPostingNumber('');
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Создать новый чат</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Номер отправления"
            value={postingNumber}
            onChange={(e) => setPostingNumber(e.target.value)}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
            inputProps={{
              style: { textTransform: 'none' }
            }}
            helperText="Введите номер отправления для создания чата с покупателем"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateChatDialogOpen(false);
              setPostingNumber('');
            }}
            disabled={creatingChat}
            size={isMobile ? "large" : "medium"}
          >
            Отмена
          </Button>
          <Button
            onClick={handleCreateChat}
            variant="contained"
            disabled={creatingChat || !postingNumber.trim()}
            startIcon={creatingChat ? <CircularProgress size={20} /> : <ChatIcon />}
            size={isMobile ? "large" : "medium"}
          >
            {creatingChat ? 'Создание...' : 'Создать чат'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OzonChats;

