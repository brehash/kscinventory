import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SellingValueByProviderProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#f59e0b', '#06b6d4', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#4f46e5', '#84cc16'];

const SellingValueByProvider: React.FC<SellingValueByProviderProps> = ({ data = [] }) => {
  // Use mock data if no data is provided or if data is empty
  const displayData = data.length > 0 ? data : [
    { name: 'Supplier A', value: 5500 },
    { name: 'Supplier B', value: 4200 },
    { name: 'Supplier C', value: 2800 },
    { name: 'Supplier D', value: 2100 },
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

export default SellingValueByProvider;