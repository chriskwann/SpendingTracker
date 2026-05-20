import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import * as XLSX from 'xlsx';

const documentDirectory = FileSystem.documentDirectory ?? '';
const EncodingType = FileSystem.EncodingType;

const CATEGORIES = [
  { label: '🍔 Food', value: 'Food' },
  { label: '🎮 Entertainment', value: 'Entertainment' },
  { label: '🛍️ Shopping', value: 'Shopping' },
  { label: '🚗 Transport', value: 'Transport' },
  { label: '📦 Others', value: 'Others' },
];

const FILTERS = ['Today', 'This Week', 'This Month', 'All'];

type Expense = {
  id: string;
  amount: number;
  category: string;
  note: string;
  date: string;
  time: string;
  timestamp: number;
};

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [filter, setFilter] = useState('This Month');
  const [budget, setBudget] = useState<number>(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('Food');
  const [quickModalVisible, setQuickModalVisible] = useState(false);

  useEffect(() => {
    loadExpenses();
    loadBudget();
    setupNotification();

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      if (response.actionIdentifier === 'LOG_EXPENSE') {
        setQuickModalVisible(true);
      }
    });

    return () => subscription.remove();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await AsyncStorage.getItem('expenses');
      if (data) setExpenses(JSON.parse(data));
    } catch (e) {}
  };

  const loadBudget = async () => {
    try {
      const data = await AsyncStorage.getItem('budget');
      if (data) setBudget(parseFloat(data));
    } catch (e) {}
  };

  const saveExpenses = async (list: Expense[]) => {
    await AsyncStorage.setItem('expenses', JSON.stringify(list));
  };

  const setupNotification = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    await Notifications.setNotificationCategoryAsync('EXPENSE', [
      {
        identifier: 'LOG_EXPENSE',
        buttonTitle: '➕ Log Expense',
        options: { opensAppToForeground: true },
      },
    ]);

    await Notifications.dismissAllNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💸 SpendingTracker',
        body: 'Tap "+ Log Expense" to quickly log a spend!',
        categoryIdentifier: 'EXPENSE',
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });
  };

  const saveBudget = async () => {
    if (!budgetInput || isNaN(Number(budgetInput))) {
      Alert.alert('Oops!', 'Please enter a valid budget amount.');
      return;
    }
    const b = parseFloat(budgetInput);
    setBudget(b);
    await AsyncStorage.setItem('budget', b.toString());
    setBudgetModalVisible(false);
    setBudgetInput('');
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setAmount('');
    setNote('');
    setSelectedCategory('Food');
    setModalVisible(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(expense.amount.toString());
    setNote(expense.note);
    setSelectedCategory(expense.category);
    setModalVisible(true);
  };

  const saveExpense = async () => {
    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Oops!', 'Please enter a valid amount.');
      return;
    }

    let updated: Expense[];

    if (editingExpense) {
      updated = expenses.map((e: Expense) =>
        e.id === editingExpense.id
          ? { ...e, amount: parseFloat(amount), category: selectedCategory, note }
          : e
      );
    } else {
      const newExpense: Expense = {
        id: Date.now().toString(),
        amount: parseFloat(amount),
        category: selectedCategory,
        note,
        date: new Date().toLocaleDateString('en-MY'),
        time: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      };
      updated = [newExpense, ...expenses];
    }

    setExpenses(updated);
    await saveExpenses(updated);
    setModalVisible(false);

    if (budget > 0) {
      const monthTotal = updated
        .filter((e: Expense) => new Date(e.timestamp).getMonth() === new Date().getMonth())
        .reduce((sum: number, e: Expense) => sum + e.amount, 0);
      if (monthTotal >= budget) {
        Alert.alert('⚠️ Budget Exceeded!', `You have exceeded your monthly budget of RM ${budget.toFixed(2)}!`);
      } else if (monthTotal >= budget * 0.8) {
        Alert.alert('⚠️ Budget Warning!', `You've used ${Math.round((monthTotal / budget) * 100)}% of your monthly budget!`);
      }
    }
  };

  const deleteExpense = (id: string) => {
    Alert.alert('Delete?', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = expenses.filter((e: Expense) => e.id !== id);
          setExpenses(updated);
          await saveExpenses(updated);
        }
      }
    ]);
  };

  const saveQuickExpense = async () => {
    if (!quickAmount || isNaN(Number(quickAmount))) {
      Alert.alert('Oops!', 'Please enter a valid amount.');
      return;
    }
    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: parseFloat(quickAmount),
      category: quickCategory,
      note: 'Quick add',
      date: new Date().toLocaleDateString('en-MY'),
      time: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    await saveExpenses(updated);
    setQuickAmount('');
    setQuickCategory('Food');
    setQuickModalVisible(false);
    Alert.alert('✅ Saved!', `RM ${newExpense.amount.toFixed(2)} logged as ${quickCategory}`);
  };

  const exportToExcel = async () => {
    try {
      if (expenses.length === 0) {
        Alert.alert('No Data', 'Add some expenses first before exporting!');
        return;
      }

      const wsData = [
        ['Date', 'Time', 'Category', 'Note', 'Amount (RM)'],
        ...expenses.map((e: Expense) => [e.date, e.time, e.category, e.note, e.amount]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `SpendingTracker_${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileUri = documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Expenses',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to export. Please try again.');
    }
  };

  const getFilteredExpenses = () => {
    const now = new Date();
    return expenses.filter((e: Expense) => {
      const ts = e.timestamp || 0;
      const d = new Date(ts);
      if (filter === 'Today') {
        return d.toDateString() === now.toDateString();
      } else if (filter === 'This Week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      } else if (filter === 'This Month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const filteredTotal = filteredExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);

  const thisMonthTotal = expenses
    .filter((e: Expense) => {
      const d = new Date(e.timestamp || 0);
      return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
    })
    .reduce((sum: number, e: Expense) => sum + e.amount, 0);

  const budgetPercent = budget > 0 ? Math.min((thisMonthTotal / budget) * 100, 100) : 0;
  const budgetColor = budgetPercent >= 100 ? '#e94560' : budgetPercent >= 80 ? '#f5a623' : '#4ecca3';

  const getCategoryEmoji = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label.split(' ')[0] || '📦';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>💸 SpendingTracker</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={exportToExcel} style={styles.exportBtn}>
              <Text style={styles.exportBtnText}>📤 Export</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBudgetModalVisible(true)} style={styles.budgetSetBtn}>
              <Text style={styles.budgetSetBtnText}>💰 Budget</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>{filter} Total</Text>
              <Text style={styles.totalAmount}>RM {filteredTotal.toFixed(2)}</Text>
            </View>
            {budget > 0 && (
              <View style={styles.budgetInfo}>
                <Text style={styles.budgetLabel}>Budget: RM {budget.toFixed(2)}</Text>
                <Text style={[styles.budgetUsed, { color: budgetColor }]}>
                  {Math.round(budgetPercent)}% used
                </Text>
              </View>
            )}
          </View>
          {budget > 0 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${budgetPercent}%` as any, backgroundColor: budgetColor }]} />
            </View>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Expense List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No expenses yet!</Text>
            <Text style={styles.emptySubText}>Tap the + button to add one</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            onLongPress={() => deleteExpense(item.id)}
          >
            <View style={styles.expenseCard}>
              <View style={styles.expenseLeft}>
                <Text style={styles.expenseEmoji}>{getCategoryEmoji(item.category)}</Text>
                <View>
                  <Text style={styles.expenseCategory}>{item.category}</Text>
                  {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
                  <Text style={styles.expenseDate}>{item.date} · {item.time}</Text>
                </View>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>RM {item.amount.toFixed(2)}</Text>
                <Text style={styles.editHint}>tap to edit</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Add Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editingExpense ? '✏️ Edit Expense' : '➕ Add Expense'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Amount (RM)"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={styles.input}
              placeholder="Note (optional)"
              placeholderTextColor="#888"
              value={note}
              onChangeText={setNote}
            />

            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryBtn, selectedCategory === cat.value && styles.categoryBtnActive]}
                  onPress={() => setSelectedCategory(cat.value)}
                >
                  <Text style={[styles.categoryBtnText, selectedCategory === cat.value && styles.categoryBtnTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={saveExpense}>
              <Text style={styles.addBtnText}>{editingExpense ? 'Update Expense' : 'Save Expense'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Budget Modal */}
      <Modal visible={budgetModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>💰 Set Monthly Budget</Text>
            <TextInput
              style={styles.input}
              placeholder="Budget amount (RM)"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={budgetInput}
              onChangeText={setBudgetInput}
            />
            <TouchableOpacity style={styles.addBtn} onPress={saveBudget}>
              <Text style={styles.addBtnText}>Save Budget</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setBudgetModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Log Modal */}
      <Modal visible={quickModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>⚡ Quick Log</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount (RM)"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={quickAmount}
              onChangeText={setQuickAmount}
              autoFocus
            />
            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryBtn, quickCategory === cat.value && styles.categoryBtnActive]}
                  onPress={() => setQuickCategory(cat.value)}
                >
                  <Text style={[styles.categoryBtnText, quickCategory === cat.value && styles.categoryBtnTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={saveQuickExpense}>
              <Text style={styles.addBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setQuickModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', padding: 24, paddingTop: 50 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  exportBtn: { backgroundColor: '#e94560', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  exportBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  budgetSetBtn: { backgroundColor: '#4ecca3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  budgetSetBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 12 },
  totalBox: { backgroundColor: '#16213e', borderRadius: 12, padding: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#aaa', fontSize: 13 },
  totalAmount: { color: '#4ecca3', fontSize: 28, fontWeight: 'bold' },
  budgetInfo: { alignItems: 'flex-end' },
  budgetLabel: { color: '#aaa', fontSize: 12 },
  budgetUsed: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  progressBar: { height: 6, backgroundColor: '#0f3460', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  filterRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f2f5' },
  filterBtnActive: { backgroundColor: '#1a1a2e' },
  filterBtnText: { fontSize: 12, color: '#888' },
  filterBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#888', fontWeight: 'bold' },
  emptySubText: { fontSize: 14, color: '#aaa', marginTop: 8 },
  expenseCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', elevation: 2,
  },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expenseEmoji: { fontSize: 28 },
  expenseCategory: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  expenseNote: { fontSize: 12, color: '#888', marginTop: 2 },
  expenseDate: { fontSize: 11, color: '#bbb', marginTop: 2 },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#e94560' },
  editHint: { fontSize: 10, color: '#bbb', marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 30, right: 24,
    backgroundColor: '#1a1a2e', width: 60, height: 60,
    borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  input: {
    backgroundColor: '#f0f2f5', borderRadius: 10, padding: 14,
    fontSize: 16, marginBottom: 12, color: '#1a1a2e',
  },
  categoryLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryBtn: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, backgroundColor: '#f0f2f5', borderWidth: 1, borderColor: '#ddd',
  },
  categoryBtnActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  categoryBtnText: { fontSize: 13, color: '#555' },
  categoryBtnTextActive: { color: '#fff' },
  addBtn: { backgroundColor: '#4ecca3', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  addBtnText: { color: '#1a1a2e', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelBtnText: { color: '#888', fontSize: 15 },
});