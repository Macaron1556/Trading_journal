package com.trading.journal.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "trading_journal") // 우리가 아까 만든 테이블 이름과 똑같이!
@Getter @Setter
public class TradingJournal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate tradeDate;   // 매매 날짜
    private String symbol;         // 종목 (BTC, ETH 등)
    private String position;
    private String result;         // 승/무/패
    private Double profit;
    private String imageUrl;       // 이미지 링크
    
    @Column(columnDefinition = "TEXT")
    private String psychology;     // 당시 심리 및 매매 근거
    
    @Column(columnDefinition = "TEXT")
    private String memo;           // 비고

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}