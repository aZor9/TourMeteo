
# Dockerfile simple pour servir Angular avec ng serve (développement)
FROM node:20-alpine
WORKDIR /app
COPY TourMeteo/package*.json ./
RUN npm install -g @angular/cli && npm install
COPY TourMeteo .
EXPOSE 4200
CMD ["ng", "serve", "--host", "0.0.0.0"]
