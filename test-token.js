const http = require('http');

// Test the token validation
const testToken = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/client-config',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add a test authorization header - you'll need to replace this with a valid token
      'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('=== Token Test Results ===');
      console.log('Status Code:', res.statusCode);
      console.log('Headers:', res.headers);
      console.log('Response:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Token is valid');
      } else {
        console.log('❌ Token is invalid or missing');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
};

// Test GraphQL endpoint with token
const testGraphQL = () => {
  const graphqlQuery = JSON.stringify({
    query: `
      query TestAuth {
        currentUser {
          id
          email
        }
      }
    `
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(graphqlQuery),
      // Add a test authorization header - you'll need to replace this with a valid token
      'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('=== GraphQL Auth Test Results ===');
      console.log('Status Code:', res.statusCode);
      console.log('Response:', data);
      
      try {
        const response = JSON.parse(data);
        if (response.data?.currentUser) {
          console.log('✅ GraphQL auth successful');
          console.log('User:', response.data.currentUser);
        } else if (response.errors) {
          console.log('❌ GraphQL auth failed');
          console.log('Errors:', response.errors);
        }
      } catch (error) {
        console.log('❌ Invalid JSON response');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(graphqlQuery);
  req.end();
};

console.log('=== Token Validation Test ===');
console.log('Note: Replace YOUR_TEST_TOKEN_HERE with an actual token from the browser');
console.log('You can get the token from browser cookies or localStorage');
console.log('');

testToken();
console.log('');
testGraphQL();
