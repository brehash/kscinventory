import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ValueByProductTypeProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#ec4899', '#8b5cf6', '#84cc16', '#ef4444', '#06b6d4', '#10b981', '#f59e0b', '#4f46e5'];

const ValueByProductType: React.FC<ValueByProductTypeProps> = ({ data = [] }) => {
  // Use mock data if no data is provided or if data is empty
  const displayData = data.length > 0 ? data : [
    { name: 'Consumer', value: 5200 },
    { name: 'Business', value: 3800 },
    { name: 'Enterprise', value: 2500 },
    { name: 'Accessories', value: 1500 },
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={displayData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={75}
            fill="#8884d8"
            dataKey="value"
          >
            {displayData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString()} RON`, 'Value']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ValueByProductType;