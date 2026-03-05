docker rm -f ai-talent-saas
docker run --name ai-talent-saas -p 8051:8040 --env-file ./server/.env -e DB_HOST=172.17.0.1 -d  ai-talent-saas
