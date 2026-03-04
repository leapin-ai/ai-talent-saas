import React from 'react';
import ReactECharts from 'echarts-for-react';
import style from '../style.module.scss';

const SkillRadarChart = ({ data }) => {
  const option = {
    radar: {
      indicator: data.employee.map(item => {
        return { name: item.dimension, max: 100 };
      }),
      radius: '65%',
      axisName: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: 500
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(241, 245, 249, 0.3)', 'rgba(241, 245, 249, 0.1)']
        }
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(241, 245, 249, 1)'
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(241, 245, 249, 1)'
        }
      }
    },
    series: [
      {
        name: '技能对比',
        type: 'radar',
        data: [
          {
            value: data.employee.map(item => parseInt(item.score)),
            name: '员工状态',
            itemStyle: {
              color: '#6366f1'
            },
            areaStyle: {
              color: 'rgba(99, 102, 241, 0.15)'
            },
            lineStyle: {
              color: 'rgba(99, 102, 241, 0.7)',
              width: 2
            },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            value: data.industry,
            name: '行业平均水平',
            itemStyle: {
              color: '#f59e0b'
            },
            areaStyle: {
              color: 'rgba(245, 158, 11, 0.1)'
            },
            lineStyle: {
              color: 'rgba(245, 158, 11, 0.5)',
              width: 1.5,
              type: 'dashed'
            },
            symbol: 'none'
          }
        ]
      }
    ],
    legend: {
      bottom: 0,
      textStyle: {
        fontSize: 10
      },
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 20
    }
  };

  return (
    <div className={style['radar-chart']}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default SkillRadarChart;
