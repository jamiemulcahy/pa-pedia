# PA-Pedia Development Container
# Includes Go, Node.js, Just, Git, and Claude Code

FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.24
ARG GO_VERSION=1.24.4
RUN wget -q https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz \
    && rm go${GO_VERSION}.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Install Just command runner
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# Use the existing 'node' user from the base image (UID/GID 1000)
# Set up Go directories with correct ownership
RUN mkdir -p /go/pkg /go/bin \
    && chown -R node:node /go

# Set up working directory
WORKDIR /workspace

# Switch to non-root user
USER node

# Configure Git for the node user
RUN git config --global init.defaultBranch main \
    && git config --global core.autocrlf input

# Default command
CMD ["bash"]
