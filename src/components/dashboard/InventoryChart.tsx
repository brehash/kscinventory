import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for demonstration
const data = [
  { name: 'Jan', value: 42 },
  { name: 'Feb', value: 53 },
  { name: 'Mar', value: 29 },
  { name: 'Apr', value: 45 },
  { name: 'May', value: 60 },
  { name: 'Jun', value: 36 },
  { name: 'Jul', value: 51 },
  { name: 'Aug', value: 48 },
];

const InventoryChart: React.FC = () => {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default InventoryChart;