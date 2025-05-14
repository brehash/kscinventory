import React from 'react';
import { Address } from '../../types';
import { Copy, Truck, MapPin } from 'lucide-react';

interface OrderAddressCardProps {
  type: 'shipping' | 'billing';
  address: Address;
}

const OrderAddressCard: React.FC<OrderAddressCardProps> = ({ type, address }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const getFormattedAddress = () => {
    return `${address.firstName} ${address.lastName}
${address.company || ''}
${address.address1}
${address.address2 || ''}
${address.city}, ${address.state} ${address.postcode}
${address.country}
${address.phone || ''}
${type === 'billing' && address.email ? address.email : ''}`;
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="flex items-center mb-4">
        {type === 'shipping' ? (
          <Truck className="h-5 w-5 text-indigo-500 mr-2" />
        ) : (
          <MapPin className="h-5 w-5 text-indigo-500 mr-2" />
        )}
        <h2 className="text-base font-semibold text-gray-800">
          {type === 'shipping' ? 'Shipping Address' : 'Billing Address'}
        </h2>
      </div>
      <div className="bg-gray-50 p-3 rounded-md">
        <div className="text-sm text-gray-900">
          <div className="font-medium">
            {address.firstName} {address.lastName}
          </div>
          {address.company && (
            <div>{address.company}</div>
          )}
          <div className="mt-1">
            {address.address1}
            {address.address2 && (
              <div>{address.address2}</div>
            )}
          </div>
          <div className="mt-1">
            {address.city}, {address.state} {address.postcode}
          </div>
          <div>{address.country}</div>
          {address.phone && (
            <div className="mt-2">{address.phone}</div>
          )}
          {type === 'billing' && address.email && (
            <div className="mt-2">{address.email}</div>
          )}
        </div>
        <button
          onClick={() => copyToClipboard(getFormattedAddress())}
          className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-900"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy address
        </button>
      </div>
    </div>
  );
};

export default OrderAddressCard;