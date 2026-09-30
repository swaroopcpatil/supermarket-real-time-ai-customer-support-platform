.DEFAULT_GOAL := help

setup:
	copy .env.example .env

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	python -m pytest services/shared_platform/tests tests -q

lint:
	ruff check services tests

seed:
	docker compose exec postgres psql -U supermarket -d supermarket -f /docker-entrypoint-initdb.d/002_seed.sql

migrate:
	docker compose exec postgres psql -U supermarket -d supermarket -f /docker-entrypoint-initdb.d/001_init.sql

migration:
	@echo "Add versioned SQL migrations under infrastructure/postgres/migrations."

clean:
	docker compose down -v --remove-orphans

help:
	@echo "Targets: setup up down logs test lint seed migrate migration clean"
