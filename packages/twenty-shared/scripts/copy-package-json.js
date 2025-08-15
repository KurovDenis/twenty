const fs = require('fs');
const path = require('path');

// Read the main package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Create a minimal package.json for the dist directory
const distPackageJson = {
  name: packageJson.name,
  main: 'twenty-shared.cjs.js',
  module: 'twenty-shared.esm.js',
  types: 'twenty-shared.cjs.d.ts',
  exports: {
    ".": {
      "types": "./twenty-shared.cjs.d.ts",
      "import": "./twenty-shared.esm.js",
      "require": "./twenty-shared.cjs.js"
    },
    "./constants": {
      "types": "./declarations/src/constants/index.d.ts",
      "import": "./constants.esm.js",
      "require": "./constants.cjs.js"
    },
    "./langgraph": {
      "types": "./declarations/src/langgraph/index.d.ts",
      "import": "./langgraph.esm.js",
      "require": "./langgraph.cjs.js"
    },
    "./testing": {
      "types": "./declarations/src/testing/index.d.ts",
      "import": "./testing.esm.js",
      "require": "./testing.cjs.js"
    },
    "./translations": {
      "types": "./declarations/src/translations/index.d.ts",
      "import": "./translations.esm.js",
      "require": "./translations.cjs.js"
    },
    "./types": {
      "types": "./declarations/src/types/index.d.ts",
      "import": "./types.esm.js",
      "require": "./types.cjs.js"
    },
    "./utils": {
      "types": "./declarations/src/utils/index.d.ts",
      "import": "./utils.esm.js",
      "require": "./utils.cjs.js"
    },
    "./workflow": {
      "types": "./declarations/src/workflow/index.d.ts",
      "import": "./workflow.esm.js",
      "require": "./workflow.cjs.js"
    },
    "./workspace": {
      "types": "./declarations/src/workspace/index.d.ts",
      "import": "./workspace.esm.js",
      "require": "./workspace.cjs.js"
    }
  },
  license: packageJson.license
};

// Write to dist directory
const distPackageJsonPath = path.join(__dirname, '..', 'dist', 'package.json');
fs.writeFileSync(distPackageJsonPath, JSON.stringify(distPackageJson, null, 2));

// Create symbolic links for the expected file names
const distDir = path.join(__dirname, '..', 'dist');

// Function to find the actual generated file and create a symlink
function createSymlink(pattern, targetName) {
  const files = fs.readdirSync(distDir);
  
  // Look for files that START with the pattern and end with .cjs.prod.js or .cjs.dev.js
  const matchingFiles = files.filter(file => 
    file.startsWith(pattern) && (file.endsWith('.cjs.prod.js') || file.endsWith('.cjs.dev.js'))
  );
  
  if (matchingFiles.length > 0) {
    // Prefer .prod.js over .dev.js
    const sourceFile = matchingFiles.find(f => f.endsWith('.cjs.prod.js')) || matchingFiles[0];
    const sourcePath = path.join(distDir, sourceFile);
    const targetPath = path.join(distDir, targetName);
    
    // Remove existing file/link if it exists
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    
    // Copy file (more reliable than symlinks on Windows)
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Created ${targetName} from ${sourceFile}`);
  } else {
    console.warn(`⚠️  Could not find file starting with: ${pattern}`);
    console.log('Available CJS files:', files.filter(f => f.includes('.cjs.')));
  }
}

// Create symlinks for each module based on actual generated files
createSymlink('AppLocales', 'translations.cjs.js');
createSymlink('FieldMetadataType', 'constants.cjs.js');
createSymlink('types-', 'types.cjs.js');
createSymlink('isValidCountryCode', 'utils.cjs.js');

console.log('✅ package.json copied to dist directory');
