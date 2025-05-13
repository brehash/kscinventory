import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SellingValueByCategoryProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#4f46e5', '#06b6d4', '#84cc16'];

const SellingValueByCategory: React.FC<SellingValueByCategoryProps> = ({ data = [] }) => {
  // Use mock data if no data is provided or if data is empty
  const displayData = data.length > 0 ? data : [
    { name: 'Electronics', value: 4800 },
    { name: 'Clothing', value: 3700 },
    { name: 'Furniture', value: 3300 },
    { name: 'Office', value: 2200 },
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

export default SellingValueByCategory;