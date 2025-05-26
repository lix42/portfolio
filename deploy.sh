#!/bin/bash
# Deployment helper

echo "🚀 Deploying Portfolio RAG Project"

echo "📦 Backend setup..."
cd backend
npm install

echo "📦 Frontend setup..."
cd ../frontend
npm install

echo "📄 To deploy backend, use Render or Fly.io"
echo "🌍 To deploy frontend, use Vercel and set root to /frontend"
