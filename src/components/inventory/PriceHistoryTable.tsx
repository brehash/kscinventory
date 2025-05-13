import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PriceHistory } from '../../types';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';

interface PriceHistoryTableProps {
  productId: string;
}

const PriceHistoryTable: React.FC<PriceHistoryTableProps> = ({ productId }) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        const priceHistoryRef = collection(db, `products/${productId}/priceHistory`);
        const q = query(priceHistoryRef, orderBy('changeDate', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setPriceHistory([]);
          setLoading(false);
          return;
        }
        
        const historyData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          changeDate: doc.data().changeDate?.toDate() || new Date()
        })) as PriceHistory[];
        
        setPriceHistory(historyData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError('Failed to load price history');
        setLoading(false);
      }
    };

    if (productId) {
      fetchPriceHistory();
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm text-gray-600">Loading price history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (priceHistory.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-sm text-gray-500">No price change history available.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Provider
            </th>
            <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Changed By
            </th>
            <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Old Cost
            </th>
            <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              New Cost
            </th>
            <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Change
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {priceHistory.map((record) => {
            const isIncrease = record.newCost > record.oldCost;
            return (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  {format(record.changeDate, 'MMM d, yyyy')}
                </td>
                <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  {record.providerName}
                </td>
                <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  {record.userName}
                </td>
                <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  {record.oldCost.toFixed(2)} RON
                </td>
                <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  {record.newCost.toFixed(2)} RON
                </td>
                <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                  <div className={`flex items-center ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                    {isIncrease ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    )}
                    <span className="font-medium">
                      {record.changePercentage.toFixed(2)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PriceHistoryTable;