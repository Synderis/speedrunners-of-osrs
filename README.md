# Speedrunners of OSRS

A comprehensive analysis tool for Old School RuneScape's Chambers of Xeric (CoX) speedrun optimization. This application provides detailed statistical analysis of gear setups, combat strategies, and optimal reset thresholds for competitive raiding. Currently hosted here: https://speedrunners-of-osrs.vercel.app/

## 🚀 Features

### Gear & Combat Analysis
[![Gear Section](https://imgur.com/GRxp84H.png)](https://imgur.com/GRxp84H.png)
- **Advanced Gear Calculator**: Comprehensive gear selection with offensive, defensive, and strength bonuses
- **Multi-Combat Style Support**: Melee, Ranged, and Magic gear configurations
- **Inventory Management**: Special item tracking (Burning claws, Voidwaker, etc.)
- **Preset System**: Save and load custom gear configurations

### Room & Monster Analysis
[![Room Section](https://imgur.com/S1vN03M.png)](https://imgur.com/S1vN03M.png)
- **Individual Room Statistics**: Detailed performance metrics for each CoX room
- **Monster Scaling**: Automatic HP and stat scaling based on player levels
- **Method Selection**: Support for different strategies (Tekton hammers, Vanguards positioning, etc.)
- **Special Attack Assignment**: Configure special weapon usage per room

### Statistical Analysis
[![Room Analysis](https://imgur.com/AhrQHW4.png)](https://imgur.com/AhrQHW4.png)
[![Raid Analysis](https://imgur.com/lrJKcAw.png)](https://imgur.com/lrJKcAw.png)
- **Kill Time Distributions**: Cumulative probability curves and expected values
- **Combined Floor Analysis**: Multi-room time optimization
- **Reset Threshold Calculator**: Optimal checkpoint decisions for speedrun attempts

### Advanced Features
- **Threshold Optimization**: Analytical calculation of optimal reset points
- **Floor-by-Floor Analysis**: Complete raid progression tracking
- **Performance Metrics**: Phase counts, one-phase odds, average phase times
- **Real-time Calculations**: Instant updates with gear/strategy changes

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Framer Motion** for animations
- **Chart.js** for data visualization
- **CSS3** with custom styling

### Backend/Computation
- **Rust** for high-performance calculations
- **WebAssembly (WASM)** for browser integration
- **Convolution algorithms** for probability distributions

### Data Management
- **Context API** for state management
- **LocalStorage** for preset persistence

## 📦 Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **Rust** (latest stable)
- **wasm-pack** for WebAssembly compilation

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/speedrunners-of-osrs.git
   cd speedrunners-of-osrs
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Build WASM modules**
   ```bash
   cd wasm-lib
   # Build each WASM module
   cd cm_cox && wasm-pack build --target web --out-dir ../../pkg/cm_cox
   cd ../distribution_normalizer && wasm-pack build --target web --out-dir ../../pkg/distribution_normalizer
   ```

4. **Start development server**
   ```bash
   cd frontend
   npm run dev
   ```

## 🎮 Usage

### Basic Workflow

1. **Select Gear**: Choose weapons, armor, and accessories for each combat style
2. **Configure Stats**: Set your combat levels
3. **Choose Rooms**: Select which CoX rooms to analyze
4. **Select Methods**: Pick specific strategies for each room
5. **Analyze Results**: View kill time distributions and optimization suggestions

### Advanced Features

#### Preset Management
- Save current configurations as custom presets
- Load community-optimized setups
- Delete unused custom presets

#### Threshold Calculation
- Input target completion times
- Get optimal reset thresholds for each checkpoint

#### Floor Analysis
- View combined statistics for Floor 1, Floor 2, Floor 3
- Account for transition delays and method variations
- Optimize full raid completion times

## 📊 Data Sources

- **Equipment Stats**: Comprehensive OSRS weapon/armor database
- **Monster Stats**: Accurate CoX monster data with scaling formulas  
- **Combat Formulas**: Precise DPS and accuracy calculations
- **Method Data**: Community-verified speedrun strategies

## ⚡ Performance Optimizations

### Computational Efficiency
- **Rust Implementation**: 100x faster than JavaScript for Monte Carlo simulations
- **Optimized Algorithms**: Histogram-based probability calculations

### Frontend Optimizations
- **Lazy Loading**: Components load on-demand
- **Memoization**: Cached calculations for repeated operations
- **Efficient Re-renders**: Optimized React state management
- **Loading States**: Progressive data loading with user feedback

### Areas for Contribution
- Tombs of Amascut
- New speedrun methods and strategies
- UI/UX improvements
- Performance optimizations
- Bug fixes and testing
- Python code accepted

## 🙏 Acknowledgments

- **OSRS Community**: Method discoveries and optimization strategies
- **Speedrun Community**: Data validation and testing
- **Special Thanks**: Pecanbread11, Wes J, Kaudal, Ryksyy