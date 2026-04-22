package com.trading.journal.controller;

import com.trading.journal.entity.TradingJournal;
import com.trading.journal.repository.TradingJournalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/journal") // 브라우저에서 /api/journal로 신호를 보내면 이리로 옵니다.
public class JournalController {

    @Autowired
    private TradingJournalRepository repository;

    // 1. 일지 저장하기 (POST 방식)
    @PostMapping
    public TradingJournal saveLog(@RequestBody TradingJournal journal) {
        return repository.save(journal);
    }

    // 2. 모든 일지 불러오기 (GET 방식)
    @GetMapping
    public List<TradingJournal> getAllLogs() {
        return repository.findAll();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteJournal(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}