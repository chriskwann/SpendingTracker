import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#4ecca3',
  Entertainment: '#e94560',
  Shopping: '#f5a623',
  Transport: '#0f3460',
  Others: '#a29bfe',
};

type Expense = {
  id: string;
  amount: number;
  category: string;
  note: string;
  date: string;
  time: string;
  timestamp: number;
};

export default function ChartsScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
      const load = async () => {
        try {
          const data = await AsyncStorage.getItem('expenses');
          if (data) setExpenses(JSON.parse(data));
        } catch (e) {}
      };
      load();

      const interval = setInterval(load, 1000);
      return () => clearInterval(interval);
    }, []);

  const now = new Date();

  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  thisMonthExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const pieData = Object.entries(categoryTotals).map(([category, amount]) => ({
    name: category,
    amount,
    color: CATEGORY_COLORS[category] || '#ccc',
    legendFontColor: '#555',
    legendFontSize: 13,
  }));

  // Last 7 days bar chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(now.getDate() - (6 - i));
    return d;
  });

  const barLabels = last7Days.map(d => d.toLocaleDateString('en-MY', { weekday: 'short' }));
  const barData = last7Days.map(d =>
    expenses
      .filter(e => new Date(e.timestamp || 0).toDateString() === d.toDateString())
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    color: (opacity = 1) => `rgba(26, 26, 46, ${opacity})`,
    labelColor: () => '#888',
    strokeWidth: 2,
    barPercentage: 0.6,
  };

  const categoryEmojis: Record<string, string> = {
    Food: '🍔',
    Entertainment: '🎮',
    Shopping: '🛍️',
    Transport: '🚗',
    Others: '📦',
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Charts & Summary</Text>
        <Text style={styles.headerSub}>Based on this month's expenses</Text>
      </View>

      {/* Total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total This Month</Text>
        <Text style={styles.totalAmount}>RM {totalThisMonth.toFixed(2)}</Text>
        <Text style={styles.totalCount}>{thisMonthExpenses.length} transactions</Text>
      </View>

      {/* Pie Chart */}
      {pieData.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          <PieChart
            data={pieData}
            width={SCREEN_WIDTH - 48}
            height={200}
            chartConfig={chartConfig}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="10"
            absolute={false}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          <Text style={styles.emptyText}>No data this month yet</Text>
        </View>
      )}

      {/* Category Breakdown List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category Breakdown</Text>
        {Object.entries(categoryTotals).length === 0 && (
          <Text style={styles.emptyText}>No data this month yet</Text>
        )}
        {Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => {
            const percent = totalThisMonth > 0 ? (amount / totalThisMonth) * 100 : 0;
            return (
              <View key={category} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <Text style={styles.categoryEmoji}>{categoryEmojis[category] || '📦'}</Text>
                  <Text style={styles.categoryName}>{category}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryAmount}>RM {amount.toFixed(2)}</Text>
                  <Text style={styles.categoryPercent}>{Math.round(percent)}%</Text>
                </View>
                <View style={styles.categoryBarBg}>
                  <View style={[styles.categoryBarFill, {
                    width: `${percent}%` as any,
                    backgroundColor: CATEGORY_COLORS[category] || '#ccc'
                  }]} />
                </View>
              </View>
            );
          })}
      </View>

      {/* Bar Chart - Last 7 Days */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 7 Days</Text>
        <BarChart
          data={{
            labels: barLabels,
            datasets: [{ data: barData.map(v => v || 0) }],
          }}
          width={SCREEN_WIDTH - 48}
          height={200}
          chartConfig={chartConfig}
          yAxisLabel="RM"
          yAxisSuffix=""
          showValuesOnTopOfBars
          fromZero
          style={{ borderRadius: 12 }}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', padding: 24, paddingTop: 50 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: '#aaa', fontSize: 13, marginTop: 4 },
  totalCard: {
    backgroundColor: '#1a1a2e', margin: 16, borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  totalLabel: { color: '#aaa', fontSize: 14 },
  totalAmount: { color: '#4ecca3', fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  totalCount: { color: '#888', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#fff', margin: 16, marginTop: 0,
    borderRadius: 16, padding: 16, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  emptyText: { color: '#aaa', textAlign: 'center', paddingVertical: 20 },
  categoryRow: { marginBottom: 16 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  categoryEmoji: { fontSize: 20 },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  categoryRight: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  categoryAmount: { fontSize: 13, color: '#555' },
  categoryPercent: { fontSize: 13, color: '#888' },
  categoryBarBg: { height: 6, backgroundColor: '#f0f2f5', borderRadius: 3, overflow: 'hidden' },
  categoryBarFill: { height: '100%', borderRadius: 3 },
});