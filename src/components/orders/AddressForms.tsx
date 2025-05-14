import React from 'react';
import { Address } from '../../types';

interface AddressFormsProps {
  billingAddress: Address;
  handleBillingChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  shippingAddress: Address;
  handleShippingChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  sameAsBilling: boolean;
  handleSameAsBillingChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: Record<string, string>;
}

const AddressForms: React.FC<AddressFormsProps> = ({
  billingAddress,
  handleBillingChange,
  shippingAddress,
  handleShippingChange,
  sameAsBilling,
  handleSameAsBillingChange,
  errors
}) => {
  return (
    <>
      {/* Billing Information */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Billing Information</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="billing_firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              id="billing_firstName"
              name="billing_firstName"
              value={billingAddress.firstName}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            {errors.billingFirstName && (
              <p className="mt-1 text-sm text-red-600">{errors.billingFirstName}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="billing_lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              id="billing_lastName"
              name="billing_lastName"
              value={billingAddress.lastName}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            {errors.billingLastName && (
              <p className="mt-1 text-sm text-red-600">{errors.billingLastName}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="billing_company" className="block text-sm font-medium text-gray-700 mb-1">
              Company (Optional)
            </label>
            <input
              type="text"
              id="billing_company"
              name="billing_company"
              value={billingAddress.company}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="billing_email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="billing_email"
              name="billing_email"
              value={billingAddress.email}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="billing_phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              id="billing_phone"
              name="billing_phone"
              value={billingAddress.phone}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="sm:col-span-2">
            <label htmlFor="billing_address1" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              id="billing_address1"
              name="billing_address1"
              value={billingAddress.address1}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            {errors.billingAddress1 && (
              <p className="mt-1 text-sm text-red-600">{errors.billingAddress1}</p>
            )}
          </div>
          
          <div className="sm:col-span-2">
            <label htmlFor="billing_address2" className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2 (Optional)
            </label>
            <input
              type="text"
              id="billing_address2"
              name="billing_address2"
              value={billingAddress.address2}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="billing_city" className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              id="billing_city"
              name="billing_city"
              value={billingAddress.city}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            {errors.billingCity && (
              <p className="mt-1 text-sm text-red-600">{errors.billingCity}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="billing_state" className="block text-sm font-medium text-gray-700 mb-1">
              State / County
            </label>
            <input
              type="text"
              id="billing_state"
              name="billing_state"
              value={billingAddress.state}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            {errors.billingState && (
              <p className="mt-1 text-sm text-red-600">{errors.billingState}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="billing_postcode" className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code
            </label>
            <input
              type="text"
              id="billing_postcode"
              name="billing_postcode"
              value={billingAddress.postcode}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            {errors.billingPostcode && (
              <p className="mt-1 text-sm text-red-600">{errors.billingPostcode}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="billing_country" className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <select
              id="billing_country"
              name="billing_country"
              value={billingAddress.country}
              onChange={handleBillingChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="RO">Romania</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="IT">Italy</option>
              <option value="ES">Spain</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Shipping Information */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Shipping Information</h2>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="sameAsBilling"
              checked={sameAsBilling}
              onChange={handleSameAsBillingChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="sameAsBilling" className="ml-2 block text-sm text-gray-900">
              Same as billing address
            </label>
          </div>
        </div>
        
        {!sameAsBilling && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping_firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                id="shipping_firstName"
                name="shipping_firstName"
                value={shippingAddress.firstName}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.shippingFirstName && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingFirstName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="shipping_lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                id="shipping_lastName"
                name="shipping_lastName"
                value={shippingAddress.lastName}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.shippingLastName && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingLastName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="shipping_company" className="block text-sm font-medium text-gray-700 mb-1">
                Company (Optional)
              </label>
              <input
                type="text"
                id="shipping_company"
                name="shipping_company"
                value={shippingAddress.company}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="shipping_phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                id="shipping_phone"
                name="shipping_phone"
                value={shippingAddress.phone}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label htmlFor="shipping_address1" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                id="shipping_address1"
                name="shipping_address1"
                value={shippingAddress.address1}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.shippingAddress1 && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingAddress1}</p>
              )}
            </div>
            
            <div className="sm:col-span-2">
              <label htmlFor="shipping_address2" className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                id="shipping_address2"
                name="shipping_address2"
                value={shippingAddress.address2}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="shipping_city" className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                id="shipping_city"
                name="shipping_city"
                value={shippingAddress.city}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.shippingCity && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingCity}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="shipping_state" className="block text-sm font-medium text-gray-700 mb-1">
                State / County
              </label>
              <input
                type="text"
                id="shipping_state"
                name="shipping_state"
                value={shippingAddress.state}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.shippingState && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingState}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="shipping_postcode" className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code
              </label>
              <input
                type="text"
                id="shipping_postcode"
                name="shipping_postcode"
                value={shippingAddress.postcode}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.shippingPostcode && (
                <p className="mt-1 text-sm text-red-600">{errors.shippingPostcode}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="shipping_country" className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                id="shipping_country"
                name="shipping_country"
                value={shippingAddress.country}
                onChange={handleShippingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="RO">Romania</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AddressForms;