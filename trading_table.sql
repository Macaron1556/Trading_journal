-- 2. 우리의 진짜 프로젝트용 창고 생성 (이름 통일: trading_db)
CREATE DATABASE IF NOT EXISTS trading_db;

-- 3. 방금 만든 창고로 입장
USE trading_db;

-- 4. 매매일지 테이블 생성 (이름: trading_journal)
CREATE TABLE IF NOT EXISTS trading_journal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trade_date DATE NOT NULL,
    symbol VARCHAR(20) NOT NULL,            -- BTC, ETH 등
    result VARCHAR(10) NOT NULL,            -- 승/무/패
    image_url TEXT,                         -- 이미지 링크
    psychology TEXT,                        -- 심리 및 근거
    memo TEXT,                              -- 비고
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);