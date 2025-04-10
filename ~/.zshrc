# ~/.zshrc

# Add Homebrew Node bin path to the beginning of PATH
export PATH="/usr/local/opt/node/bin:$PATH"

# Add Node global bin to PATH if it exists
if [ -d "/usr/local/Cellar/node/23.10.0_1/bin" ]; then
  export PATH="/usr/local/Cellar/node/23.10.0_1/bin:$PATH"
fi

# ... existing zshrc content ... 