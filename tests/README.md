# App 1 Test Suite

This directory contains unit tests for the ContriFlow system (App 1) - the Organization Management layer.

## Structure

- **`setup.js`** - Vitest configuration and Firebase mocks
  - Global Firebase SDK mocks
  - Helper functions to create mock data
  - Mock generators for Firestore documents

- **`unit/`** - Unit tests for each service
  - `auth-service.test.js` - Authentication flow and user document management
  - `org-manager.test.js` - Organization loading and member management
  - `super-admin-service.test.js` - Organization creation and super admin operations

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI dashboard
npm run test:ui
```

## What's Tested

### AuthService
- ✓ Sign up (email/password)
- ✓ Sign in (email/password)
- ✓ Sign out
- ✓ User document creation in Firestore
- ✓ Error handling (invalid email, permissions, etc.)
- ✓ Auth state change listeners

### OrgManager
- ✓ Load organization by slug
- ✓ Load user's organizations
- ✓ Add member to organization
- ✓ Update member role
- ✓ Remove member
- ✓ Error handling

### SuperAdminService
- ✓ Validate Firebase config
- ✓ Generate organization slug
- ✓ Check slug uniqueness
- ✓ Create organization
- ✓ Get all organizations
- ✓ Update organization status
- ✓ Delete organization
- ✓ Create admin user
- ✓ Error handling

## Firebase Mocking Strategy

All tests use mocked Firebase calls:

```javascript
// Tests don't hit real Firebase
mockCentralFirestore.collection('organizations').doc('slug').get()
  .mockResolvedValueOnce(mockSnapshot)

// Tests validate correct parameters are passed
expect(mockCentralFirestore.collection).toHaveBeenCalledWith('organizations')

// Tests verify error scenarios
.mockRejectedValueOnce(new Error('permission-denied'))
```

## Adding New Tests

1. Create file in `tests/unit/` named `{service-name}.test.js`
2. Import mocks from `setup.js`:
   ```javascript
   import { resetFirebaseMocks, createMockUser, createMockOrg } from '../setup.js';
   ```
3. Use test structure:
   ```javascript
   describe('ServiceName', () => {
     beforeEach(() => {
       resetFirebaseMocks(); // Clean state before each test
     });

     it('should do something', () => {
       // Arrange
       const mockData = createMockOrg();
       
       // Act
       const result = await someFunction();
       
       // Assert
       expect(result).toBe(expected);
     });
   });
   ```

## Next Steps

After tests pass, we'll:
1. Implement state management system
2. Add dependency injection to services
3. Refactor for better separation of concerns
4. Build metrics collection on top of clean base
