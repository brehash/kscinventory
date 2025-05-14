import React from 'react';
import { OrdersByMonthData } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OrdersChartProps {
  data: OrdersByMonthData[];
}

const OrdersChart: React.FC<OrdersChartProps> = ({ data = [] }) => {
  // Use mock data if no data is provided or if data is empty
  const displayData = data.length > 0 ? data : [
    { name: 'Jan', count: 12, revenue: 5200 },
    { name: 'Feb', count: 19, revenue: 7800 },
    { name: 'Mar', count: 15, revenue: 6300 },
    { name: 'Apr', count: 21, revenue: 9100 },
    { name: 'May', count: 18, revenue: 7600 },
    { name: 'Jun', count: 24, revenue: 10500 },
    { name: 'Jul', count: 20, revenue: 8400 },
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={displayData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'count') return [`${value} orders`, 'Orders'];
              if (name === 'revenue') return [`${value.toLocaleString()} RON`, 'Revenue'];
              return [value, name];
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="count" name="Orders" fill="#8884d8" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#82ca9d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OrdersChart;