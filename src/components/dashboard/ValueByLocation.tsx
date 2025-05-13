import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ValueByLocationProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#4f46e5', '#84cc16'];

const ValueByLocation: React.FC<ValueByLocationProps> = ({ data = [] }) => {
  // Use mock data if no data is provided or if data is empty
  const displayData = data.length > 0 ? data : [
    { name: 'Warehouse A', value: 3500 },
    { name: 'Warehouse B', value: 2800 },
    { name: 'Store Front', value: 1900 },
    { name: 'Office', value: 1200 },
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

export default ValueByLocation;