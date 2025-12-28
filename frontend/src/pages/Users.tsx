import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  useMediaQuery,
  IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';
import { User } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    role: 'collector' as 'director' | 'collector'
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      handleError(error, 'Ошибка при загрузке пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setFormData({ login: '', password: '', role: 'collector' });
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({ login: '', password: '', role: 'collector' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/users', formData);
      toast.success('Пользователь создан');
      handleCloseDialog();
      fetchUsers();
    } catch (error) {
      handleError(error, 'Ошибка при создании пользователя');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      login: user.login,
      password: '', // Пароль не показываем при редактировании
      role: user.role
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingUser(null);
    setFormData({ login: '', password: '', role: 'collector' });
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.id) {
      toast.error('Ошибка: не указан ID пользователя');
      return;
    }

    setSubmitting(true);

    try {
      const updateData: any = {
        login: formData.login,
        role: formData.role
      };

      // Добавляем пароль только если он указан
      if (formData.password && formData.password.trim()) {
        updateData.password = formData.password;
      }

      await api.put(`/users/${editingUser.id}`, updateData);
      toast.success('Пользователь обновлён');
      handleCloseEditDialog();
      fetchUsers();
    } catch (error) {
      handleError(error, 'Ошибка при обновлении пользователя');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (loginConfirm: string) => {
    if (!userToDelete || !userToDelete.id) {
      toast.error('Ошибка: не указан ID пользователя');
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/users/${userToDelete.id}`, {
        data: { loginConfirm }
      });
      toast.success('Пользователь удалён');
      fetchUsers();
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      handleError(error, 'Ошибка при удалении пользователя');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: 3 
      }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Пользователи
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          fullWidth={isMobile}
          size={isMobile ? "large" : "medium"}
        >
          Создать пользователя
        </Button>
      </Box>

      <TableContainer 
        component={Paper}
        sx={{
          overflowX: 'auto',
          '& .MuiTable-root': {
            minWidth: 400,
          }
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Логин</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                Действия
              </TableCell>
              <TableCell align="center" sx={{ display: { xs: 'table-cell', sm: 'none' } }}>
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary">
                    Пользователи не найдены
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => (
                <TableRow key={user.id || `user-${index}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {user.login}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      color={user.role === 'director' ? 'primary.main' : 'text.secondary'}
                      fontWeight={user.role === 'director' ? 'bold' : 'normal'}
                      variant="body2"
                    >
                      {user.role === 'director' ? 'Директор' : 'Сборщик'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEdit(user)}
                      >
                        Редактировать
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteClick(user)}
                      >
                        Удалить
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: 'table-cell', sm: 'none' } }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEdit(user)}
                        sx={{ padding: '8px' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(user)}
                        sx={{ padding: '8px' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle>Создать пользователя</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Логин"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              margin="normal"
              required
              size={isMobile ? "small" : "medium"}
            />
            <TextField
              fullWidth
              label="Пароль"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              margin="normal"
              required
              size={isMobile ? "small" : "medium"}
            />
            <TextField
              fullWidth
              select
              label="Роль"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as 'director' | 'collector' })
              }
              margin="normal"
              required
              size={isMobile ? "small" : "medium"}
            >
              <MenuItem value="director">Директор</MenuItem>
              <MenuItem value="collector">Сборщик</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} size={isMobile ? "large" : "medium"}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={submitting}
              size={isMobile ? "large" : "medium"}
            >
              {submitting ? <CircularProgress size={24} /> : 'Создать'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog 
        open={editDialogOpen} 
        onClose={handleCloseEditDialog} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <form onSubmit={handleUpdateSubmit}>
          <DialogTitle>Редактировать пользователя</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Логин"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              margin="normal"
              required
              size={isMobile ? "small" : "medium"}
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Новый пароль (оставьте пустым, чтобы не менять)"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              margin="normal"
              helperText="Оставьте пустым, если не хотите менять пароль"
              size={isMobile ? "small" : "medium"}
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              select
              label="Роль"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as 'director' | 'collector' })
              }
              margin="normal"
              required
              size={isMobile ? "small" : "medium"}
            >
              <MenuItem value="director">Директор</MenuItem>
              <MenuItem value="collector">Сборщик</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEditDialog} size={isMobile ? "large" : "medium"}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={submitting}
              size={isMobile ? "large" : "medium"}
            >
              {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        type="user"
        name={userToDelete?.login || ''}
        confirmValue={userToDelete?.login || ''}
        loading={deleting}
      />
    </Box>
  );
};

export default Users;

