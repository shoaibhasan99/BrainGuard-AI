# Stripe Test Card Details

When testing payments in your app, use these test card numbers provided by Stripe. These only work in **test mode** (not in production).

## ✅ Successful Payment Cards

### Standard Visa (Most Common)
- **Card Number:** `4242 4242 4242 4242`
- **Expiry Date:** Any future date (e.g., `12/25` or `12/30`)
- **CVC:** Any 3 digits (e.g., `123`)
- **ZIP/Postal Code:** Any 5 digits (e.g., `12345`)

### Standard Mastercard
- **Card Number:** `5555 5555 5555 4444`
- **Expiry Date:** Any future date
- **CVC:** Any 3 digits
- **ZIP/Postal Code:** Any 5 digits

### Standard American Express
- **Card Number:** `3782 822463 10005`
- **Expiry Date:** Any future date
- **CVC:** Any 4 digits (e.g., `1234`)
- **ZIP/Postal Code:** Any 5 digits

## ❌ Declined Payment Cards

### Card Declined (Generic)
- **Card Number:** `4000 0000 0000 0002`
- **Expiry Date:** Any future date
- **CVC:** Any 3 digits
- **ZIP/Postal Code:** Any 5 digits
- **Result:** Card will be declined

### Insufficient Funds
- **Card Number:** `4000 0000 0000 9995`
- **Expiry Date:** Any future date
- **CVC:** Any 3 digits
- **ZIP/Postal Code:** Any 5 digits
- **Result:** Insufficient funds error

### Expired Card
- **Card Number:** `4000 0000 0000 0069`
- **Expiry Date:** Any past date (e.g., `01/20`)
- **CVC:** Any 3 digits
- **ZIP/Postal Code:** Any 5 digits
- **Result:** Expired card error

## 🔄 3D Secure Authentication Cards

### Requires Authentication (3D Secure)
- **Card Number:** `4000 0027 6000 3184`
- **Expiry Date:** Any future date
- **CVC:** Any 3 digits
- **ZIP/Postal Code:** Any 5 digits
- **Result:** Will prompt for 3D Secure authentication

### 3D Secure Authentication Failed
- **Card Number:** `4000 0000 0000 3055`
- **Expiry Date:** Any future date
- **CVC:** Any 3 digits
- **ZIP/Postal Code:** Any 5 digits
- **Result:** Authentication will fail

## 📝 Important Notes

1. **Test Mode Only:** These cards only work when your Stripe account is in **test mode**. Check your Stripe Dashboard to confirm you're in test mode.

2. **Any Name:** You can use any name on the card (e.g., "Test User", "John Doe")

3. **Any Address:** You can use any billing address

4. **PKR Currency:** Since your app uses PKR, Stripe will convert the amount. Make sure your Stripe account supports PKR or use a supported currency.

5. **Real Cards:** Never use real credit card numbers in test mode - they won't work and it's a security risk.

## 🧪 Testing Scenarios

### Test Successful Payment
```
Card: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
ZIP: 12345
```
Expected: Payment succeeds, status changes to "completed"

### Test Declined Payment
```
Card: 4000 0000 0000 0002
Expiry: 12/25
CVC: 123
ZIP: 12345
```
Expected: Payment fails, error message shown

### Test 3D Secure
```
Card: 4000 0027 6000 3184
Expiry: 12/25
CVC: 123
ZIP: 12345
```
Expected: 3D Secure popup appears, authenticate to complete

## 🔗 Additional Resources

- [Stripe Test Cards Documentation](https://stripe.com/docs/testing)
- [Stripe Testing Guide](https://stripe.com/docs/testing)

