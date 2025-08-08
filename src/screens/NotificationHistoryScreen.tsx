import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  List,
  Divider,
  Chip,
  IconButton,
  ProgressBar,
  Searchbar,
  Menu,
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { 
  StoredNotification,
  NotificationHistory,
  ReportCategory,
  NotificationStatus,
  NotificationPriority,
} from '../types';
import { NotificationStorage } from '../services/notificationStorage';

export const NotificationHistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<NotificationHistory | null>(null);
  const [filteredNotifications, setFilteredNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | ReportCategory | NotificationStatus>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNotificationHistory();
    }, [])
  );

  useEffect(() => {
    if (history) {
      filterNotifications();
    }
  }, [history, searchQuery, selectedFilter]);

  const loadNotificationHistory = async () => {
    try {
      setLoading(true);
      const notificationHistory = await NotificationStorage.getNotificationHistory();
      setHistory(notificationHistory);
    } catch (error) {
      console.error('Error loading notification history:', error);
      Alert.alert('Error', 'Failed to load notification history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotificationHistory();
    setRefreshing(false);
  };

  const filterNotifications = () => {
    if (!history) return;

    let filtered = history.notifications;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category/status filter
    if (selectedFilter !== 'all') {
      if (['unread', 'read', 'dismissed', 'archived'].includes(selectedFilter)) {
        filtered = filtered.filter(notification => notification.status === selectedFilter);
      } else {
        filtered = filtered.filter(notification => notification.category === selectedFilter);
      }
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await NotificationStorage.updateNotificationStatus(notificationId, 'read');
      await loadNotificationHistory();
    } catch (error) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const markAsDismissed = async (notificationId: string) => {
    try {
      await NotificationStorage.updateNotificationStatus(notificationId, 'dismissed');
      await loadNotificationHistory();
    } catch (error) {
      Alert.alert('Error', 'Failed to dismiss notification');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationStorage.deleteNotification(notificationId);
              await loadNotificationHistory();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete notification');
            }
          },
        },
      ]
    );
  };

  const markAllAsRead = async () => {
    try {
      await NotificationStorage.markAllAsRead();
      await loadNotificationHistory();
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  };

  const cleanupOldNotifications = async () => {
    Alert.alert(
      'Cleanup Old Notifications',
      'This will remove notifications older than 30 days. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          onPress: async () => {
            try {
              const deletedCount = await NotificationStorage.cleanupOldNotifications(30);
              await loadNotificationHistory();
              Alert.alert('Success', `Cleaned up ${deletedCount} old notifications`);
            } catch (error) {
              Alert.alert('Error', 'Failed to cleanup notifications');
            }
          },
        },
      ]
    );
  };

  const toggleSelection = (notificationId: string) => {
    const newSelection = new Set(selectedNotifications);
    if (newSelection.has(notificationId)) {
      newSelection.delete(notificationId);
    } else {
      newSelection.add(notificationId);
    }
    setSelectedNotifications(newSelection);
  };

  const deleteSelectedNotifications = async () => {
    if (selectedNotifications.size === 0) return;

    Alert.alert(
      'Delete Selected',
      `Delete ${selectedNotifications.size} selected notifications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const id of selectedNotifications) {
                await NotificationStorage.deleteNotification(id);
              }
              setSelectedNotifications(new Set());
              setSelectionMode(false);
              await loadNotificationHistory();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete selected notifications');
            }
          },
        },
      ]
    );
  };

  const getCategoryEmoji = (category: ReportCategory): string => {
    const emojis: Record<ReportCategory, string> = {
      police_checkpoint: '🚔',
      accident: '🚨',
      road_hazard: '⚠️',
      traffic_jam: '🚗',
      weather_alert: '🌧️',
      general: '📍',
    };
    return emojis[category];
  };

  const getStatusColor = (status: NotificationStatus): string => {
    const colors: Record<NotificationStatus, string> = {
      unread: '#F44336',
      read: '#4CAF50',
      dismissed: '#FF9800',
      archived: '#9E9E9E',
    };
    return colors[status];
  };

  const getPriorityColor = (priority: NotificationPriority): string => {
    const colors: Record<NotificationPriority, string> = {
      low: '#4CAF50',
      normal: '#2196F3',
      high: '#FF9800',
      urgent: '#F44336',
    };
    return colors[priority];
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ProgressBar indeterminate />
          <Text style={styles.loadingText}>Loading notification history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with search and filter */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search notifications..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        <Menu
          visible={showFilterMenu}
          onDismiss={() => setShowFilterMenu(false)}
          anchor={
            <IconButton
              icon="filter"
              onPress={() => setShowFilterMenu(true)}
            />
          }
        >
          <Menu.Item onPress={() => { setSelectedFilter('all'); setShowFilterMenu(false); }} title="All" />
          <Menu.Item onPress={() => { setSelectedFilter('unread'); setShowFilterMenu(false); }} title="Unread" />
          <Menu.Item onPress={() => { setSelectedFilter('read'); setShowFilterMenu(false); }} title="Read" />
          <Menu.Item onPress={() => { setSelectedFilter('police_checkpoint'); setShowFilterMenu(false); }} title="Police" />
          <Menu.Item onPress={() => { setSelectedFilter('accident'); setShowFilterMenu(false); }} title="Accidents" />
          <Menu.Item onPress={() => { setSelectedFilter('road_hazard'); setShowFilterMenu(false); }} title="Hazards" />
        </Menu>
      </View>

      {/* Statistics */}
      {history && (
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{history.total_count}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#F44336' }]}>{history.unread_count}</Text>
                <Text style={styles.statLabel}>Unread</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{filteredNotifications.length}</Text>
                <Text style={styles.statLabel}>Filtered</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <Button
          mode="outlined"
          onPress={markAllAsRead}
          style={styles.actionButton}
          icon="check-all"
          compact
        >
          Mark All Read
        </Button>
        
        <Button
          mode="outlined"
          onPress={cleanupOldNotifications}
          style={styles.actionButton}
          icon="delete-sweep"
          compact
        >
          Cleanup
        </Button>
        
        <Button
          mode={selectionMode ? 'contained' : 'outlined'}
          onPress={() => setSelectionMode(!selectionMode)}
          style={styles.actionButton}
          icon="select-all"
          compact
        >
          Select
        </Button>
      </View>

      {/* Notifications list */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredNotifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No notifications found</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card key={notification.id} style={styles.notificationCard}>
              <TouchableOpacity
                onPress={() => selectionMode ? toggleSelection(notification.id) : markAsRead(notification.id)}
                onLongPress={() => {
                  setSelectionMode(true);
                  toggleSelection(notification.id);
                }}
              >
                <Card.Content>
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationTitle}>
                      <Text style={styles.categoryEmoji}>{getCategoryEmoji(notification.category)}</Text>
                      <Text style={styles.title} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      {selectionMode && (
                        <IconButton
                          icon={selectedNotifications.has(notification.id) ? 'check-circle' : 'circle-outline'}
                          size={20}
                          onPress={() => toggleSelection(notification.id)}
                        />
                      )}
                    </View>
                    
                    <View style={styles.notificationMeta}>
                      <Chip
                        style={[styles.statusChip, { backgroundColor: getStatusColor(notification.status) }]}
                        textStyle={{ color: 'white', fontSize: 10 }}
                      >
                        {notification.status}
                      </Chip>
                      <Chip
                        style={[styles.priorityChip, { backgroundColor: getPriorityColor(notification.priority) }]}
                        textStyle={{ color: 'white', fontSize: 10 }}
                      >
                        {notification.priority}
                      </Chip>
                    </View>
                  </View>
                  
                  <Text style={styles.body} numberOfLines={2}>
                    {notification.body}
                  </Text>
                  
                  <View style={styles.notificationFooter}>
                    <Text style={styles.username}>
                      {notification.username || 'Anonymous'}
                    </Text>
                    <Text style={styles.timestamp}>
                      {formatTimeAgo(notification.created_at)}
                    </Text>
                  </View>
                  
                  {!selectionMode && (
                    <View style={styles.notificationActions}>
                      {notification.status === 'unread' && (
                        <IconButton
                          icon="check"
                          size={16}
                          onPress={() => markAsRead(notification.id)}
                        />
                      )}
                      <IconButton
                        icon="close"
                        size={16}
                        onPress={() => markAsDismissed(notification.id)}
                      />
                      <IconButton
                        icon="delete"
                        size={16}
                        onPress={() => deleteNotification(notification.id)}
                      />
                    </View>
                  )}
                </Card.Content>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* FAB for bulk actions */}
      {selectionMode && selectedNotifications.size > 0 && (
        <FAB
          icon="delete"
          style={styles.fab}
          onPress={deleteSelectedNotifications}
          label={`Delete ${selectedNotifications.size}`}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    flex: 1,
    marginRight: 8,
  },
  statsCard: {
    margin: 16,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  emptyCard: {
    marginTop: 50,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  notificationCard: {
    marginBottom: 8,
    elevation: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  notificationMeta: {
    flexDirection: 'row',
    gap: 4,
  },
  statusChip: {
    height: 20,
    paddingHorizontal: 6,
  },
  priorityChip: {
    height: 20,
    paddingHorizontal: 6,
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#F44336',
  },
});
