package com.trading.journal.repository;

import com.trading.journal.entity.TradingJournal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TradingJournalRepository extends JpaRepository<TradingJournal, Long> {
    // 기본 저장, 삭제, 조회 기능이 자동으로 포함됩니다.
}