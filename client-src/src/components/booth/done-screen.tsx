"use client";

import { useEffect, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { DEPARTMENTS, SCHOOL_NAME } from "@/lib/departments";

const AUTO_RESET = 10;

/**
 * 완료 화면. 가만히 두면 저절로 처음 화면으로 돌아간다 —
 * 학생이 사진만 들고 가버려도 다음 사람이 바로 쓸 수 있어야 한다.
 *
 * 마지막에 학과 이름을 한 번 더 크게 둔다. 부스의 목적이 학과 홍보라서,
 * 사진을 받아 든 그 순간이 이름을 남길 가장 좋은 자리다.
 */
export function DoneScreen({ onReset }: { onReset: () => void }) {
  const [left, setLeft] = useState(AUTO_RESET);

  useEffect(() => {
    if (left <= 0) {
      onReset();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onReset]);

  return (
    <Screen tone="mint">
      <TopRule label="완료" right={<span className="text-lg font-semibold">{SCHOOL_NAME}</span>} />

      <div className="mt-14">
        {/* 11rem 이면 768px 아이패드에서 가로를 넘긴다 (글자 4개 × 176px > 쓸 수 있는 폭 704px) */}
        <h1 className="headline text-[8.5rem] leading-[0.85]">다 됐어요</h1>
        <p className="mt-6 text-4xl font-bold">프린터에서 사진을 가져가세요</p>
      </div>

      <div className="flex-1" />

      <div className="border-ink border-t pt-8">
        <p className="text-xl font-bold">우리 학교 다섯 학과</p>
        <div className="mt-5 grid grid-cols-5 gap-3">
          {DEPARTMENTS.map((d) => (
            <div key={d.id} className="bg-ink text-paper px-4 py-5">
              <p className="text-xl font-bold">{d.name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <BigButton variant="line" wide onClick={onReset}>
          처음으로 ({left})
        </BigButton>
      </div>
    </Screen>
  );
}
