from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./clause-tracker.db"
    max_upload_size_bytes: int = 5 * 1024 * 1024
    allowed_extensions: tuple[str, ...] = (".txt", ".md")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
