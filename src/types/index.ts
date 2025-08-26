// Recording Types
export interface RecordedAction {
  id: string;
  type: 'click' | 'input' | 'navigate' | 'wallet' | 'wait' | 'submit';
  timestamp: number;
  selector?: string;
  xpath?: string;
  value?: string;
  url?: string;
  coordinates?: { 
    x: number; 
    y: number;
    pageX?: number;
    pageY?: number;
  };
  element?: {
    tag: string;
    text?: string;
    value?: string;
    placeholder?: string;
    type?: string;
    href?: string;
    className?: string;
    id?: string;
    name?: string;
    role?: string;
    ariaLabel?: string;
    dataTestId?: string;
    innerHTML?: string;
    outerHTML?: string;
    attributes?: Record<string, string>;
    position?: {
      top: number;
      left: number;
      width: number;
      height: number;
      x?: number;
      y?: number;
    };
    computed?: {
      display: string;
      visibility: string;
      opacity: string;
      zIndex: string;
    };
    parents?: string[];
    frameInfo?: {
      isInFrame: boolean;
      frameUrl: string;
    };
  };
  formData?: Record<string, any>;
  walletMethod?: string;
  walletParams?: any;
  isSwapAction?: boolean;
  isAmountInput?: boolean;
  eventDetails?: {
    bubbles: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  };
}

export interface NetworkRequest {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  postData?: string;
  resourceType?: string;
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: string;
  };
}

export interface WalletAction {
  type: 'connect' | 'approve' | 'reject' | 'sign' | 'transaction' | 'wallet';
  timestamp: number;
  method?: string;
  params?: any;
  details?: any;
  selector?: string;
  value?: string;
}

export interface Recording {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  duration: number;
  actions: RecordedAction[];
  networkRequests: NetworkRequest[];
  walletActions: WalletAction[] | RecordedAction[];
  metadata: {
    browser: string;
    viewport: { width: number; height: number };
    hasWallet: boolean;
    frames?: any[];
    chainInfo?: ChainInfo;
    balanceInfo?: BalanceInfo;
    swapSettings?: SwapSettings;
  };
}

export interface RecorderConfig {
  autoSave: boolean;
  captureWallet: boolean;
  captureNetwork: boolean;
  debug: boolean;
  smartWait: boolean;
  frameSupport: boolean;
  balanceMonitoring: boolean;
  chainDetection: boolean;
  swapValidation: boolean;
}

// Enhanced Browser Types
export interface BrowserConfig {
  headless: boolean;
  defaultViewport: {
    width: number;
    height: number;
  };
  args: string[];
  executablePath?: string;
  memoryLimit?: string;
  cpuLimit?: number;
}

// Enhanced Chain Types
export interface ChainInfo {
  chainId: string;
  network: string;
  rpc: string;
  gasPrice: string;
  blockTime: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorer?: string;
  faucet?: string;
  isTestnet: boolean;
}

// Enhanced Balance Types
export interface BalanceInfo {
  address: string;
  nativeBalance: string;
  tokenBalances: Map<string, string>;
  timestamp: number;
  usdValue?: number;
  lastUpdated: string;
}

// Enhanced Swap Settings Types
export interface SwapSettings {
  slippage: string;
  gasSettings: {
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    gasStrategy: 'auto' | 'manual' | 'optimized';
  };
  deadline?: number;
  priceImpact?: string;
  route?: string;
}

// Enhanced Optimizer Types
export interface OptimizedData {
  swapFlow: SwapAction[];
  apiEndpoints: ApiEndpoint[];
  essentialSelectors: Map<string, string>;
  walletActions: WalletAction[];
  balanceAnalysis: BalanceAnalysis;
  chainAnalysis: ChainAnalysis;
  swapValidation: SwapValidation;
  summary: OptimizationSummary;
}

export interface SwapAction {
  id: number;
  action: 'SELECT_FROM' | 'SELECT_TO' | 'INPUT_AMOUNT' | 'CLICK_SWAP' | 'APPROVE' | 'CONFIRM';
  value?: string;
  selector?: string;
  timestamp?: number;
  metadata?: {
    tokenAddress?: string;
    tokenSymbol?: string;
    amount?: string;
    price?: string;
    slippage?: string;
    gasEstimate?: string;
  };
}

export interface ApiEndpoint {
  url: string;
  method: string;
  purpose: 'quote' | 'swap' | 'approve' | 'token_list' | 'price' | 'balance' | 'gas' | 'other';
  params?: any;
  headers?: any;
  responsePattern?: any;
  successRate?: number;
  avgResponseTime?: number;
}

export interface OptimizationSummary {
  originalActions: number;
  optimizedActions: number;
  duplicatesRemoved: number;
  compressionRatio: string;
  swapDetected: boolean;
  dexType?: string;
  swapComplexity: 'simple' | 'medium' | 'complex';
  estimatedSuccessRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  recordingQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

// NEW: Balance Analysis Types
export interface BalanceAnalysis {
  initialBalance: string;
  finalBalance: string;
  balanceChange: string;
  gasUsed: string;
  gasCost: string;
  totalCost: string;
  tokenBalances: Map<string, string>;
  usdValueChange?: number;
  percentageChange?: number;
}

// NEW: Chain Analysis Types
export interface ChainAnalysis {
  chainId: string;
  network: string;
  rpc: string;
  gasPrice: string;
  blockTime: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  gasEstimate: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  networkCongestion: 'low' | 'medium' | 'high';
  recommendedGasPrice?: string;
}

// NEW: Swap Validation Types
export interface SwapValidation {
  isReady: boolean;
  warnings: string[];
  recommendations: string[];
  estimatedGas: string;
  estimatedCost: string;
  slippageTolerance: string;
  priceImpact: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    score: number;
  };
  gasOptimization?: {
    suggestedGasLimit: string;
    suggestedGasPrice: string;
    potentialSavings: string;
  };
}

// NEW: Performance Monitoring Types
export interface PerformanceMetrics {
  memoryUsage: {
    actions: number;
    network: number;
    lastCleanup: number;
    peakUsage: number;
  };
  recordingStats: {
    startTime: number;
    duration: number;
    actionsPerSecond: number;
    errors: number;
    recoveryAttempts: number;
  };
  browserStats: {
    activePages: number;
    processId?: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
}

// NEW: Error Handling Types
export interface RecordingError {
  id: string;
  timestamp: number;
  context: string;
  error: string;
  stackTrace?: string;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// NEW: Swap Flow Analysis Types
export interface SwapFlowAnalysis {
  flowId: string;
  steps: SwapFlowStep[];
  estimatedDuration: number;
  successProbability: number;
  potentialIssues: string[];
  optimizationSuggestions: string[];
}

export interface SwapFlowStep {
  stepNumber: number;
  action: string;
  selector: string;
  expectedDuration: number;
  critical: boolean;
  fallbackOptions?: string[];
}

// NEW: Token Information Types
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: string;
  logoURI?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
}

// NEW: Gas Optimization Types
export interface GasOptimization {
  currentGasPrice: string;
  recommendedGasPrice: string;
  gasLimit: string;
  estimatedCost: string;
  potentialSavings: string;
  optimizationStrategy: 'aggressive' | 'balanced' | 'conservative';
  timeToExecute: number;
}

// NEW: Risk Assessment Types
export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  riskScore: number;
  recommendations: string[];
  mitigationStrategies: string[];
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  probability: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

// NEW: Recording Quality Types
export interface RecordingQuality {
  score: number;
  factors: QualityFactor[];
  overall: 'poor' | 'fair' | 'good' | 'excellent';
  improvements: string[];
}

export interface QualityFactor {
  factor: string;
  score: number;
  weight: number;
  description: string;
}

// Export all types
export * from './index.js';